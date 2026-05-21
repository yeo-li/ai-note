import assert from "node:assert/strict";
import test from "node:test";
import { createJsonApiClient } from "./ai-api-client.mjs";
import { OrganizeProviderError } from "./organize/organize-provider.mjs";

function createResponse({ ok = true, status = 200, payload }) {
  return {
    ok,
    status,
    async json() {
      return payload;
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

test("json api client sends Gemini generateContent request", async () => {
  let requestUrl = "";
  let requestInit = null;
  const client = createJsonApiClient({
    apiKey: "test-key",
    model: "gemini-test-model",
    request(url, init) {
      requestUrl = url;
      requestInit = init;
      return Promise.resolve(createResponse({ payload: createGeminiOutput({ ok: true }) }));
    }
  });

  await client.requestJson({
    prompt: "prompt",
    schemaName: "test_schema",
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    parseFailureMessage: "parse failed"
  });

  const requestBody = JSON.parse(requestInit.body);

  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent");
  assert.equal(requestInit.headers["x-goog-api-key"], "test-key");
  assert.equal(requestInit.headers.Authorization, undefined);
  assert.equal(requestBody.contents[0].role, "user");
  assert.match(requestBody.contents[0].parts[0].text, /prompt/);
  assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
  assert.equal(requestBody.generationConfig.responseSchema.type, "OBJECT");
  assert.equal(requestBody.generationConfig.responseSchema.properties.ok.type, "BOOLEAN");
  assert.equal("additionalProperties" in requestBody.generationConfig.responseSchema, false);
});

test("json api client uses AI_NOTE_AI_MODEL in the Gemini generateContent URL", async () => {
  const previousModel = process.env.AI_NOTE_AI_MODEL;
  process.env.AI_NOTE_AI_MODEL = "gemini-env-model";
  let requestUrl = "";

  try {
    const client = createJsonApiClient({
      apiKey: "test-key",
      request(url) {
        requestUrl = url;
        return Promise.resolve(createResponse({ payload: createGeminiOutput({ ok: true }) }));
      }
    });

    await client.requestJson({
      prompt: "prompt",
      schemaName: "test_schema",
      schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
      parseFailureMessage: "parse failed"
    });

    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-env-model:generateContent");
  } finally {
    if (previousModel === undefined) {
      delete process.env.AI_NOTE_AI_MODEL;
    } else {
      process.env.AI_NOTE_AI_MODEL = previousModel;
    }
  }
});

test("json api client extracts Gemini candidate text output", async () => {
  const client = createJsonApiClient({
    apiKey: "test-key",
    request() {
      return Promise.resolve(createResponse({ payload: createGeminiOutput({ value: "from-gemini" }) }));
    }
  });

  const result = await client.requestJson({
    prompt: "prompt",
    schemaName: "test_schema",
    schema: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false },
    parseFailureMessage: "parse failed"
  });

  assert.deepEqual(result, { value: "from-gemini" });
});

test("json api client rejects non-loopback http API URLs before sending the key", async () => {
  let called = false;
  const client = createJsonApiClient({
    apiKey: "test-key",
    apiUrl: "http://example.com/v1beta",
    request() {
      called = true;
      return Promise.resolve(createResponse({ payload: createGeminiOutput({}) }));
    }
  });

  await assert.rejects(
    client.requestJson({
      prompt: "prompt",
      schemaName: "test_schema",
      schema: { type: "object", properties: {}, additionalProperties: false },
      parseFailureMessage: "parse failed"
    }),
    (error) => error instanceof OrganizeProviderError && error.code === "API_CONFIGURATION_INVALID"
  );
  assert.equal(called, false);
});

test("json api client rejects untrusted https API URLs before sending the key", async () => {
  let called = false;
  const client = createJsonApiClient({
    apiKey: "test-key",
    apiUrl: "https://example.com/v1beta",
    request() {
      called = true;
      return Promise.resolve(createResponse({ payload: createGeminiOutput({}) }));
    }
  });

  await assert.rejects(
    client.requestJson({
      prompt: "prompt",
      schemaName: "test_schema",
      schema: { type: "object", properties: {}, additionalProperties: false },
      parseFailureMessage: "parse failed"
    }),
    (error) => error instanceof OrganizeProviderError && error.code === "API_CONFIGURATION_INVALID"
  );
  assert.equal(called, false);
});

test("json api client allows loopback http API URLs for local development", async () => {
  let requestUrl = "";
  const client = createJsonApiClient({
    apiKey: "test-key",
    apiUrl: "http://127.0.0.1:1234/v1beta",
    request(url) {
      requestUrl = url;
      return Promise.resolve(createResponse({ payload: createGeminiOutput({ ok: true }) }));
    }
  });

  const result = await client.requestJson({
    prompt: "prompt",
    schemaName: "test_schema",
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    parseFailureMessage: "parse failed"
  });

  assert.equal(requestUrl, "http://127.0.0.1:1234/v1beta/models/gemini-2.5-flash:generateContent");
  assert.deepEqual(result, { ok: true });
});
