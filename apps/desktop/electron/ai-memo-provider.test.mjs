import assert from "node:assert/strict";
import test from "node:test";
import { createAiMemoProvider } from "./ai-memo-provider.mjs";
import { OrganizeProviderError } from "./organize/organize-provider.mjs";

function createApiClient(handler) {
  return {
    async requestJson(request) {
      return handler(request);
    }
  };
}

test("ai memo provider searches memo ids through api client", async () => {
  const provider = createAiMemoProvider({
    apiClient: createApiClient(({ prompt, schemaName }) => {
      assert.equal(schemaName, "memo_search_result");
      assert.match(prompt, /계약 일정/);
      return { memoIds: ["memo-2", 3] };
    })
  });

  const result = await provider.searchMemos({
    query: "계약 일정",
    memos: [
      { id: "memo-1", title: "점심", body: "메뉴" },
      { id: "memo-2", title: "계약", body: "일정" }
    ]
  });

  assert.deepEqual(result, ["memo-2", "3"]);
});

test("ai memo provider composes memo from api client", async () => {
  const provider = createAiMemoProvider({
    currentDate: "2026-05-21",
    apiClient: createApiClient(({ prompt, schemaName }) => {
      assert.equal(schemaName, "memo_compose_result");
      assert.match(prompt, /새 메모/);
      assert.match(prompt, /Do not force a fixed template/);
      assert.match(prompt, /Current local date: 2026-05-21/);
      assert.match(prompt, /Remove or exclude tasks whose explicit due date is before the current local date/);
      assert.doesNotMatch(prompt, /body must visibly contain these section headings/);
      return {
        decision: "compose",
        title: "계약 정리",
        body: "계약 일정 확인\n- 다음 미팅 전까지 초안을 검토한다.",
        sourceMemoIds: ["memo-1"],
        message: ""
      };
    })
  });

  const result = await provider.composeMemos({
    prompt: "새 메모",
    memos: [{ id: "memo-1", title: "계약", body: "계약 일정 확인" }]
  });

  assert.deepEqual(result, {
    kind: "composed",
    title: "계약 정리",
    body: "계약 일정 확인\n- 다음 미팅 전까지 초안을 검토한다.",
    sourceMemoIds: ["memo-1"]
  });
});

test("ai memo provider rejects malformed compose api output", async () => {
  const provider = createAiMemoProvider({
    apiClient: createApiClient(() => ({ decision: "compose", title: "", body: "" }))
  });

  await assert.rejects(
    provider.composeMemos({ prompt: "새 메모", memos: [] }),
    (error) => error instanceof OrganizeProviderError && error.code === "API_PARSE_FAILED"
  );
});

test("ai memo provider lets API client use AI_NOTE_AI_MODEL by default", async () => {
  const previousModel = process.env.AI_NOTE_AI_MODEL;
  process.env.AI_NOTE_AI_MODEL = "gemini-memo-model";
  let requestUrl = "";

  try {
    const provider = createAiMemoProvider({
      apiKey: "test-key",
      request(url) {
        requestUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          async json() {
            return {
              candidates: [
                {
                  content: {
                    parts: [
                      { text: JSON.stringify({ memoIds: ["memo-1"] }) }
                    ]
                  }
                }
              ]
            };
          }
        });
      }
    });

    await provider.searchMemos({
      query: "계약",
      memos: [{ id: "memo-1", title: "계약", body: "본문" }]
    });
    assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/models/gemini-memo-model:generateContent");
  } finally {
    if (previousModel === undefined) {
      delete process.env.AI_NOTE_AI_MODEL;
    } else {
      process.env.AI_NOTE_AI_MODEL = previousModel;
    }
  }
});
