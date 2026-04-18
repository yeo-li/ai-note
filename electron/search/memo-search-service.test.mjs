import assert from "node:assert/strict";
import test from "node:test";
import {
  createMemoSearchService,
  rankMemoSearchResults,
  scoreMemoLexically
} from "./memo-search-service.mjs";

function createMemo(overrides = {}) {
  return {
    id: overrides.id ?? "memo-1",
    title: overrides.title ?? "Untitled memo",
    body: overrides.body ?? "",
    createdAt: overrides.createdAt ?? "2026-04-09T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-09T09:00:00.000Z"
  };
}

test("lexical scoring prefers exact title and phrase matches", () => {
  const closeTitle = createMemo({
    id: "memo-title",
    title: "Today call with procurement",
    body: "Need the revised vendor timeline."
  });
  const bodyOnly = createMemo({
    id: "memo-body",
    title: "Weekly sync",
    body: "Today call with procurement about the revised vendor timeline."
  });

  const results = rankMemoSearchResults([bodyOnly, closeTitle], "today call procurement");

  assert.equal(results.length, 2);
  assert.equal(results[0]?.memo.id, "memo-title");
  assert.deepEqual(results[0]?.matchedTerms, ["today", "call", "procurement"]);
});

test("search results break score ties by freshest memo", () => {
  const older = createMemo({
    id: "older",
    title: "Expense follow-up",
    body: "Send expense follow-up today",
    updatedAt: "2026-04-08T09:00:00.000Z"
  });
  const newer = createMemo({
    id: "newer",
    title: "Expense follow-up",
    body: "Send expense follow-up today",
    updatedAt: "2026-04-09T09:00:00.000Z"
  });

  const results = rankMemoSearchResults([older, newer], "expense follow-up");

  assert.equal(results[0]?.memo.id, "newer");
  assert.equal(results[1]?.memo.id, "older");
});

test("preview centers around the first matched term in the body", () => {
  const memo = createMemo({
    body: "Parking lot, quick intro, then ask procurement for the revised contract timeline and approval flow before Friday."
  });

  const scored = scoreMemoLexically(memo, "contract timeline");

  assert.ok(scored);
  assert.match(scored.preview, /contract timeline/i);
  assert.ok(scored.matchedTerms.includes("contract"));
  assert.ok(scored.matchedTerms.includes("timeline"));
});

test("search service returns empty results for blank queries", async () => {
  const searchService = createMemoSearchService({
    async listMemos() {
      return [createMemo()];
    }
  });

  assert.deepEqual(await searchService.search("   "), []);
});

test("search service is pluggable for future semantic ranking", async () => {
  const memos = [
    createMemo({ id: "a", title: "One" }),
    createMemo({ id: "b", title: "Two" })
  ];
  const searchService = createMemoSearchService({
    async listMemos() {
      return memos;
    },
    rankMemos(items, query) {
      assert.equal(query, "custom");
      return items
        .slice()
        .reverse()
        .map((memo, index) => ({
          memo,
          score: 100 - index,
          preview: memo.title,
          matchedTerms: ["custom"]
        }));
    }
  });

  const results = await searchService.search("custom");

  assert.deepEqual(
    results.map((result) => result.memo.id),
    ["b", "a"]
  );
});
