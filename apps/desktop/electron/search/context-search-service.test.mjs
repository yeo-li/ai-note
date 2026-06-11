import assert from "node:assert/strict";
import test from "node:test";
import { buildContextSearchPreview, buildContextSearchReason, createContextSearchService } from "./context-search-service.mjs";

function createMemo(overrides = {}) {
  return {
    id: overrides.id ?? "memo-1",
    title: overrides.title ?? "Untitled memo",
    body: overrides.body ?? "",
    createdAt: overrides.createdAt ?? "2026-04-09T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-09T09:00:00.000Z"
  };
}

test("buildContextSearchPreview centers the excerpt on a matched term", () => {
  const memo = createMemo({
    body: "Parking lot intro, then ask procurement for the revised contract timeline before Friday."
  });

  const preview = buildContextSearchPreview(memo, "procurement");

  assert.match(preview, /procurement/);
});

test("buildContextSearchPreview returns empty string when memo has no content", () => {
  const memo = createMemo({ title: "", body: "" });

  assert.equal(buildContextSearchPreview(memo, "anything"), "");
});

test("buildContextSearchReason names matched terms when present", () => {
  const memo = createMemo({ title: "Weekly sync", body: "Discuss procurement timeline" });

  const reason = buildContextSearchReason(memo, "procurement timeline");

  assert.match(reason, /procurement/);
  assert.match(reason, /timeline/);
});

test("buildContextSearchReason falls back to a generic reason without matches", () => {
  const memo = createMemo({ title: "Weekly sync", body: "Discuss roadmap" });

  assert.equal(buildContextSearchReason(memo, "ab"), "AI가 요청 맥락과 관련된 메모로 선택했습니다.");
});

test("createContextSearchService maps AI-selected memo ids to preview/reason results", async () => {
  const memos = [
    createMemo({ id: "memo-a", title: "Procurement plan", body: "Vendor timeline review" }),
    createMemo({ id: "memo-b", title: "Lunch notes", body: "Sandwich shop ideas" })
  ];

  const service = createContextSearchService({
    listMemos: async () => memos,
    aiMemoProvider: {
      async searchMemos() {
        return ["memo-a"];
      }
    }
  });

  const results = await service.search("procurement timeline");

  assert.equal(results.length, 1);
  assert.equal(results[0].memo.id, "memo-a");
  assert.match(results[0].preview, /Vendor timeline/);
  assert.match(results[0].reason, /procurement/);
});
