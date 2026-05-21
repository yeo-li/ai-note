import { createJsonApiClient, defaultTimeoutMs } from "../ai-api-client.mjs";
import { OrganizeProviderError } from "./organize-provider.mjs";

function buildInstruction(input) {
  const intentGuide =
      input.intent === "polite"
          ? "Rewrite into a polite, send-ready tone."
          : "Improve clarity, spacing, and natural phrasing.";

  const userPrompt = input.prompt?.trim()
      ? `User instruction (ABSOLUTE PRIORITY): ${input.prompt.trim()}`
      : "No additional user instruction.";

  return [
    "You are a deterministic memo rewriting engine.",
    "You MUST behave like a strict transformation system, not a creative writer.",
    "",
    "====================",
    "# SYSTEM CONTRACT",
    "====================",
    "You MUST transform input -> output under strict rules.",
    "This prompt is a CONTRACT, not a suggestion.",
    "",
    "====================",
    "# PRIORITY ORDER (STRICT)",
    "====================",
    "1. User instruction",
    "2. Output schema",
    "3. Meaning preservation",
    "4. Intent guidance",
    "If conflict occurs -> obey ONLY higher priority.",
    "",
    "====================",
    "# TASK DEFINITION",
    "====================",
    "- Rewrite memo while preserving meaning.",
    "- Do NOT change facts.",
    "- Do NOT drop important information.",
    "- Do NOT hallucinate.",
    "",
    "====================",
    "# ALLOWED OPERATIONS",
    "====================",
    "- simplify wording",
    "- restructure sentences",
    "- improve readability",
    "- adjust tone",
    "- add minimal connective words ONLY if necessary",
    "",
    "====================",
    "# FORBIDDEN OPERATIONS",
    "====================",
    "- adding new facts",
    "- removing key meaning",
    "- over-summarizing",
    "- changing intent",
    "- ignoring user instruction",
    "",
    "====================",
    "# CLEANING RULE (ORIGINAL FIELD)",
    "====================",
    "- trim whitespace",
    "- fix formatting ONLY",
    "- DO NOT paraphrase",
    "- DO NOT rewrite",
    "",
    "====================",
    "# SUMMARY RULE",
    "====================",
    "- EXACTLY ONE Korean sentence",
    "- MUST describe transformation",
    "- MUST NOT describe content",
    "- MUST be specific",
    "- <=20 characters recommended",
    "- BAD examples:",
    "  x 수정함",
    "  x 개선함",
    "- GOOD examples:",
    "  - 문장을 간결하게 축약",
    "  - 구조를 목록형으로 재구성",
    "",
    "====================",
    "# OUTPUT SCHEMA (STRICT)",
    "====================",
    "{",
    '  "summary": string,',
    '  "original": string,',
    '  "suggested": string',
    "}",
    "",
    "====================",
    "# OUTPUT RULES",
    "====================",
    "- Return ONLY JSON",
    "- NO markdown",
    "- NO explanation",
    "- NO extra fields",
    "- MUST be parseable JSON",
    "- Escape quotes properly",
    "- Preserve line breaks with \\n",
    "",
    "====================",
    "# SELF VALIDATION (MANDATORY)",
    "====================",
    "Before output, internally verify:",
    "1. Is JSON valid?",
    "2. Did I follow priority rules?",
    "3. Did I avoid hallucination?",
    "4. Is summary compliant?",
    "If ANY fails -> fix before output.",
    "",
    "====================",
    "# INPUT",
    "====================",
    "<instruction>",
    userPrompt,
    "</instruction>",
    "",
    "<intent>",
    intentGuide,
    "</intent>",
    "",
    "<context>",
    `Intent: ${input.intent}`,
    `Title: ${input.title ?? ""}`,
    "</context>",
    "",
    "<memo>",
    input.body,
    "</memo>"
  ]
      .filter(Boolean)
      .join("\n");
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["original", "suggested", "summary"],
    properties: {
      original: { type: "string" },
      suggested: { type: "string" },
      summary: { type: "string" }
    }
  };
}

export function createGeminiApiOrganizeProvider({ apiClient, apiKey, apiUrl, model, timeoutMs = defaultTimeoutMs, request } = {}) {
  const client = apiClient ?? createJsonApiClient({ apiKey, apiUrl, model, timeoutMs, request });

  return {
    async organize(input) {
      const parsed = await client.requestJson({
        prompt: buildInstruction(input),
        schema: buildSchema(),
        schemaName: "memo_organize_result",
        parseFailureMessage: "AI API 응답을 정리 결과로 해석하지 못했어요."
      });

      if (!parsed?.suggested || !parsed?.summary || !parsed?.original) {
        throw new OrganizeProviderError("API_PARSE_FAILED", "AI API 응답을 정리 결과로 해석하지 못했어요.");
      }

      return {
        intent: input.intent,
        original: String(parsed.original),
        suggested: String(parsed.suggested),
        summary: String(parsed.summary),
        provider: "api",
        fallbackErrorMessage: null
      };
    }
  };
}
