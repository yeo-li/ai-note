import { OrganizeProviderError } from "./organize/organize-provider.mjs";

export const defaultApiUrl = "https://generativelanguage.googleapis.com/v1beta";
export const defaultModel = "gemini-2.5-flash";
export const defaultTimeoutMs = 300000;
const trustedHttpsHostnames = new Set(["generativelanguage.googleapis.com"]);
const schemaTypes = new Set(["array", "boolean", "integer", "number", "object", "string"]);

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeApiUrl(apiUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(apiUrl);
  } catch (error) {
    throw new OrganizeProviderError("API_CONFIGURATION_INVALID", "AI API URL 설정이 올바르지 않아요. HTTPS URL을 사용해 주세요.", error);
  }

  if ((parsedUrl.protocol === "https:" && trustedHttpsHostnames.has(parsedUrl.hostname)) || (parsedUrl.protocol === "http:" && isLoopbackHostname(parsedUrl.hostname))) {
    return parsedUrl.toString();
  }

  throw new OrganizeProviderError("API_CONFIGURATION_INVALID", "AI API URL 설정이 올바르지 않아요. 기본 API 또는 로컬 개발 URL을 사용해 주세요.");
}

function buildGenerateContentUrl(apiUrl, model) {
  const normalizedBaseUrl = normalizeApiUrl(apiUrl).replace(/\/+$/u, "");

  if (normalizedBaseUrl.endsWith(":generateContent")) {
    return normalizedBaseUrl;
  }

  const normalizedModel = model.replace(/^models\//u, "").trim();

  return `${normalizedBaseUrl}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

function toGeminiSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map(toGeminiSchema);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, value]) => {
        if (key === "type" && typeof value === "string" && schemaTypes.has(value.toLowerCase())) {
          return [key, value.toUpperCase()];
        }

        return [key, toGeminiSchema(value)];
      })
  );
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}

function extractOutputText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function normalizeApiError(error, parseFailureMessage) {
  if (error instanceof OrganizeProviderError) {
    return error;
  }

  if (error?.name === "AbortError") {
    return new OrganizeProviderError("API_TIMEOUT", "AI API 응답이 늦어서 요청을 중단했어요. 잠시 뒤 다시 시도해 주세요.", error);
  }

  if (error instanceof SyntaxError) {
    return new OrganizeProviderError("API_PARSE_FAILED", parseFailureMessage, error);
  }

  return new OrganizeProviderError("API_FAILED", "AI API 요청에 실패했어요. 네트워크 상태를 확인해 주세요.", error);
}

function createResponseError(status) {
  if (status === 401 || status === 403) {
    return new OrganizeProviderError("API_AUTHENTICATION_FAILED", "AI API 인증에 실패했어요. API_KEY 값을 확인해 주세요.");
  }

  if (status === 429) {
    return new OrganizeProviderError("API_RATE_LIMITED", "AI API 사용량 제한에 도달했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  if (status >= 500 && status <= 599) {
    return new OrganizeProviderError("API_TEMPORARILY_UNAVAILABLE", "AI API가 일시적으로 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.");
  }

  return new OrganizeProviderError("API_FAILED", `AI API 요청에 실패했어요. (status ${status})`);
}

export function createJsonApiClient({
  apiKey = process.env.API_KEY,
  apiUrl = process.env.AI_NOTE_API_URL || defaultApiUrl,
  model = process.env.AI_NOTE_AI_MODEL || defaultModel,
  timeoutMs = defaultTimeoutMs,
  request = fetch
} = {}) {
  return {
    async requestJson({ prompt, schema, schemaName, parseFailureMessage }) {
      if (!apiKey?.trim()) {
        throw new OrganizeProviderError("API_KEY_MISSING", "API_KEY 환경변수가 필요해요. API 키를 설정한 뒤 다시 실행해 주세요.");
      }

      const generateContentUrl = buildGenerateContentUrl(apiUrl, model);
      const timeout = createTimeoutSignal(timeoutMs);

      try {
        const response = await request(generateContentUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: toGeminiSchema(schema)
            }
          }),
          signal: timeout.signal
        });

        if (!response.ok) {
          throw createResponseError(response.status);
        }

        const payload = await response.json();
        const outputText = extractOutputText(payload);

        if (!outputText) {
          throw new OrganizeProviderError("API_PARSE_FAILED", parseFailureMessage);
        }

        return JSON.parse(outputText);
      } catch (error) {
        throw normalizeApiError(error, parseFailureMessage);
      } finally {
        timeout.clear();
      }
    }
  };
}
