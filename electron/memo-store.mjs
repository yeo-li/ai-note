import { randomUUID } from "node:crypto";

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBody(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function assertMemoId(id) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new TypeError("Memo id must be a non-empty string.");
  }

  return id.trim();
}

function cloneMemo(memo) {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

function createMemoStore(initialMemos = []) {
  const memos = new Map(initialMemos.map((memo) => [memo.id, cloneMemo(memo)]));

  return {
    list() {
      return [...memos.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(cloneMemo);
    },
    get(id) {
      const memo = memos.get(assertMemoId(id));
      return memo ? cloneMemo(memo) : null;
    },
    create(input = {}) {
      const now = new Date().toISOString();
      const memo = {
        id: randomUUID(),
        title: normalizeText(input.title),
        body: normalizeBody(input.body),
        createdAt: now,
        updatedAt: now
      };

      memos.set(memo.id, memo);
      return cloneMemo(memo);
    },
    update(id, patch = {}) {
      const memoId = assertMemoId(id);
      const current = memos.get(memoId);

      if (!current) {
        throw new Error(`Memo not found: ${memoId}`);
      }

      const nextMemo = {
        ...current,
        title: patch.title === undefined ? current.title : normalizeText(patch.title),
        body: patch.body === undefined ? current.body : normalizeBody(patch.body),
        updatedAt: new Date().toISOString()
      };

      memos.set(memoId, nextMemo);
      return cloneMemo(nextMemo);
    },
    delete(id) {
      return memos.delete(assertMemoId(id));
    }
  };
}

export { createMemoStore };
