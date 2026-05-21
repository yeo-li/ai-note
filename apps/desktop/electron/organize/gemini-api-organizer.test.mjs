import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiApiOrganizeProvider } from "./gemini-api-organizer.mjs";
import { OrganizeProviderError } from "./organize-provider.mjs";

function createResponse({ ok = true, status = 200, output }) {
  return {
    ok,
    status,
    async json() {
      return output;
    }
  };
}

function createGeminiOutput(value) {
  return {
    candidates: [
      {
        content: {
          parts: [
            { text: JSON.stringify(value) }
          ]
        }
      }
    ]
  };
}

test("gemini organize provider sends structured API request and parses output", async () => {
  let requestUrl = "";
  let requestInit = null;
  const provider = createGeminiApiOrganizeProvider({
    apiKey: "test-key",
    request(url, init) {
      requestUrl = url;
      requestInit = init;

      return Promise.resolve(createResponse({
        output: createGeminiOutput({
          original: "원문",
          suggested: "정리된 원문",
          summary: "읽기 좋게 정리"
        })
      }));
    }
  });

  const result = await provider.organize({ memoId: "memo-1", body: "원문", intent: "polish", prompt: "더 자연스럽게" });
  const requestBody = JSON.parse(requestInit.body);

  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(requestInit.headers["x-goog-api-key"], "test-key");
  assert.equal(requestInit.headers.Authorization, undefined);
  assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(requestBody.generationConfig.responseSchema.required, ["original", "suggested", "summary"]);
  assert.equal(requestBody.generationConfig.responseSchema.properties.original.type, "STRING");
  assert.equal(requestBody.contents[0].role, "user");
  assert.match(requestBody.contents[0].parts[0].text, /1\. User instruction/);
  assert.match(requestBody.contents[0].parts[0].text, /User instruction \(ABSOLUTE PRIORITY\): 더 자연스럽게/);
  assert.match(requestBody.contents[0].parts[0].text, /SELF VALIDATION \(MANDATORY\)/);
  assert.equal(result.suggested, "정리된 원문");
  assert.equal(result.summary, "읽기 좋게 정리");
  assert.equal(result.provider, "api");
});

test("gemini organize provider lets API client use AI_NOTE_AI_MODEL by default", async () => {
  const previousModel = process.env.AI_NOTE_AI_MODEL;
  process.env.AI_NOTE_AI_MODEL = "gemini-organize-model";
  let requestUrl = "";

  try {
    const provider = createGeminiApiOrganizeProvider({
      apiKey: "test-key",
      request(url) {
        requestUrl = url;
        return Promise.resolve(createResponse({
          output: createGeminiOutput({
            original: "원문",
            suggested: "정리된 원문",
            summary: "읽기 좋게 정리"
          })
        }));
      }
    });

    await provider.organize({ memoId: "memo-1", body: "원문", intent: "polish" });
    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-organize-model:generateContent");
  } finally {
    if (previousModel === undefined) {
      delete process.env.AI_NOTE_AI_MODEL;
    } else {
      process.env.AI_NOTE_AI_MODEL = previousModel;
    }
  }
});

test("gemini organize provider maps missing API_KEY to a user-facing error", async () => {
  const provider = createGeminiApiOrganizeProvider({
    apiKey: ""
  });

  await assert.rejects(
    provider.organize({ memoId: "memo-1", body: "원문", intent: "polish" }),
    (error) => error instanceof OrganizeProviderError && error.code === "API_KEY_MISSING"
  );
});

test("gemini organize provider maps auth failure to a user-facing error", async () => {
  const provider = createGeminiApiOrganizeProvider({
    apiKey: "bad-key",
    request() {
      return Promise.resolve(createResponse({ ok: false, status: 401, output: {} }));
    }
  });

  await assert.rejects(
    provider.organize({ memoId: "memo-1", body: "원문", intent: "polish" }),
    (error) => error instanceof OrganizeProviderError && error.code === "API_AUTHENTICATION_FAILED"
  );
});
