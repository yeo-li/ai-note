import assert from "node:assert/strict";
import test from "node:test";
import { createComposeService, normalizeComposeInput } from "./compose-service.mjs";

function createMemo(overrides = {}) {
  return {
    id: overrides.id ?? "memo-1",
    title: overrides.title ?? "Untitled memo",
    body: overrides.body ?? "",
    createdAt: overrides.createdAt ?? "2026-04-09T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-09T09:00:00.000Z"
  };
}

test("normalizeComposeInput trims prompt and validates intent", () => {
  assert.deepEqual(normalizeComposeInput({ prompt: "  do it  ", intent: "polish" }), {
    prompt: "do it",
    intent: "polish"
  });
  assert.equal(normalizeComposeInput({ prompt: "", intent: "polish" }), null);
  assert.equal(normalizeComposeInput({ prompt: "do it", intent: "rude" }), null);
  assert.equal(normalizeComposeInput(null), null);
});

test("compose refuses when there are no memos", async () => {
  const service = createComposeService({
    listMemos: async () => [],
    aiMemoProvider: {
      async searchMemos() {
        return [];
      },
      async composeMemos() {
        throw new Error("should not be called");
      }
    }
  });

  const result = await service.compose({ prompt: "정리해줘", intent: "polish" });

  assert.equal(result.kind, "refused");
  assert.equal(result.refusalReason, "no_related_memos");
});

test("compose refuses when AI provider finds no related memos", async () => {
  const memos = [createMemo({ id: "memo-a" })];
  const service = createComposeService({
    listMemos: async () => memos,
    aiMemoProvider: {
      async searchMemos() {
        return [];
      },
      async composeMemos() {
        throw new Error("should not be called");
      }
    }
  });

  const result = await service.compose({ prompt: "정리해줘", intent: "polish" });

  assert.equal(result.kind, "refused");
  assert.equal(result.refusalReason, "no_related_memos");
  assert.deepEqual(result.relatedMemoIds, []);
});

test("compose refuses with insufficient_support when provider declines", async () => {
  const memos = [createMemo({ id: "memo-a" }), createMemo({ id: "memo-b" })];
  const service = createComposeService({
    listMemos: async () => memos,
    aiMemoProvider: {
      async searchMemos() {
        return ["memo-a", "memo-b"];
      },
      async composeMemos() {
        return { kind: "refused", message: "근거 부족" };
      }
    }
  });

  const result = await service.compose({ prompt: "정리해줘", intent: "polish" });

  assert.equal(result.kind, "refused");
  assert.equal(result.refusalReason, "insufficient_support");
  assert.equal(result.message, "근거 부족");
  assert.deepEqual(result.relatedMemoIds, ["memo-a", "memo-b"]);
});

test("compose refuses when result source memo ids are not part of related memos", async () => {
  const memos = [createMemo({ id: "memo-a" }), createMemo({ id: "memo-b" })];
  const service = createComposeService({
    listMemos: async () => memos,
    aiMemoProvider: {
      async searchMemos() {
        return ["memo-a", "memo-b"];
      },
      async composeMemos() {
        return {
          kind: "composed",
          title: "정리 결과",
          body: "본문",
          sourceMemoIds: ["memo-unrelated"]
        };
      }
    }
  });

  const result = await service.compose({ prompt: "정리해줘", intent: "polish" });

  assert.equal(result.kind, "refused");
  assert.equal(result.refusalReason, "insufficient_support");
});

test("compose returns a composed result and tracks busy state for related memos", async () => {
  const memos = [createMemo({ id: "memo-a" }), createMemo({ id: "memo-b" }), createMemo({ id: "memo-c" })];
  const busyEvents = [];
  const service = createComposeService({
    listMemos: async () => memos,
    aiMemoProvider: {
      async searchMemos() {
        return ["memo-a", "memo-b"];
      },
      async composeMemos() {
        return {
          kind: "composed",
          title: "정리 결과",
          body: "본문",
          sourceMemoIds: ["memo-a", "memo-b"]
        };
      }
    },
    onMemoBusyChange: (memoId, busy) => {
      busyEvents.push({ memoId, busy });
    }
  });

  const result = await service.compose({ prompt: "정리해줘", intent: "polish" });

  assert.equal(result.kind, "composed");
  assert.equal(result.title, "정리 결과");
  assert.deepEqual(result.relatedMemoIds, ["memo-a", "memo-b"]);
  assert.deepEqual(result.sourceMemoIds, ["memo-a", "memo-b"]);
  assert.equal(result.sourceCount, 2);
  assert.deepEqual(busyEvents, [
    { memoId: "memo-a", busy: true },
    { memoId: "memo-b", busy: true },
    { memoId: "memo-a", busy: false },
    { memoId: "memo-b", busy: false }
  ]);
});
