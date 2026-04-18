import { randomUUID } from "node:crypto";

export const MEMO_STORE_VERSION = 1;
export const MEMO_STORE_FILENAME = "memos.json";
export const MEMO_SQLITE_FILENAME = "memos.db";
export const LEGACY_NOTE_STORE_FILENAME = "notes.json";

function normalizeTimestamp(value) {
  return typeof value === "string" && value.length > 0 ? value : new Date().toISOString();
}

function normalizeTitle(value) {
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

export function normalizeMemo(memo) {
  return {
    id: typeof memo.id === "string" && memo.id.length > 0 ? memo.id : randomUUID(),
    title: normalizeTitle(memo.title),
    body: normalizeBody(memo.body),
    createdAt: normalizeTimestamp(memo.createdAt),
    updatedAt: normalizeTimestamp(memo.updatedAt)
  };
}

export function cloneMemo(memo) {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

export function sortMemosByUpdatedAt(memos) {
  return [...memos].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function parseStorePayload(parsed) {
  if (Array.isArray(parsed.memos)) {
    return {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(parsed.memos.map(normalizeMemo))
    };
  }

  if (Array.isArray(parsed.notes)) {
    return {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(parsed.notes.map(normalizeMemo))
    };
  }

  return {
    version: MEMO_STORE_VERSION,
    memos: []
  };
}
