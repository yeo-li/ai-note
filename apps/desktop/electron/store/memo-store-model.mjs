import { randomUUID } from "node:crypto";

export const MEMO_STORE_VERSION = 1;
export const MEMO_STORE_FILENAME = "memos.json";
export const MEMO_SQLITE_FILENAME = "memos.db";
export const LEGACY_NOTE_STORE_FILENAME = "notes.json";

function normalizeTimestamp(value) {
  return typeof value === "string" && value.length > 0 ? value : new Date().toISOString();
}

function toTimestampMs(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
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

function normalizeFavorite(value) {
  return value === true;
}

export function normalizeMemo(memo) {
  return {
    id: typeof memo.id === "string" && memo.id.length > 0 ? memo.id : randomUUID(),
    title: normalizeTitle(memo.title),
    body: normalizeBody(memo.body),
    favorite: normalizeFavorite(memo.favorite),
    createdAt: normalizeTimestamp(memo.createdAt),
    updatedAt: normalizeTimestamp(memo.updatedAt)
  };
}

export function cloneMemo(memo) {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    favorite: memo.favorite,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

export function sortMemosByUpdatedAt(memos) {
  return [...memos].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createTimestampAfter(values = []) {
  const timestampValues = Array.isArray(values) ? values : [values];
  const latestTimestamp = timestampValues.reduce((latest, value) => {
    const timestamp = toTimestampMs(value);
    return timestamp === null ? latest : Math.max(latest, timestamp);
  }, Date.now());

  return new Date(latestTimestamp + 1).toISOString();
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
