import { randomUUID } from "node:crypto";
import { MEMO_CATEGORIES, MEMO_CATEGORY_LABELS, normalizeMemoCategoryValue } from "@ai-note/shared/memo";

export const MEMO_STORE_VERSION = 1;
export const MEMO_STORE_FILENAME = "memos.json";
export const MEMO_SQLITE_FILENAME = "memos.db";
export const LEGACY_NOTE_STORE_FILENAME = "notes.json";
export const DEFAULT_CATEGORY_TIMESTAMP = "1970-01-01T00:00:00.000Z";
export const RESERVED_CATEGORY_IDS = new Set(["all"]);

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

export function normalizeCategory(value) {
  const category = normalizeMemoCategoryValue(value);
  return category && !RESERVED_CATEGORY_IDS.has(category) ? category : null;
}

export function normalizeMemo(memo) {
  return {
    id: typeof memo.id === "string" && memo.id.length > 0 ? memo.id : randomUUID(),
    title: normalizeTitle(memo.title),
    body: normalizeBody(memo.body),
    favorite: normalizeFavorite(memo.favorite),
    category: normalizeCategory(memo.category),
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
    category: memo.category,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

function normalizeCategoryLabel(value) {
  return normalizeMemoCategoryValue(value);
}

export function createBuiltinCategoryDefinitions() {
  return MEMO_CATEGORIES.map((category) => ({
    id: category,
    label: MEMO_CATEGORY_LABELS[category] ?? category,
    builtin: true,
    createdAt: DEFAULT_CATEGORY_TIMESTAMP,
    updatedAt: DEFAULT_CATEGORY_TIMESTAMP
  }));
}

export function normalizeCategoryDefinition(input = {}) {
  const id = normalizeCategory(input.id ?? input.label);
  const label = normalizeCategoryLabel(input.label ?? input.id);

  if (!id || RESERVED_CATEGORY_IDS.has(id)) {
    return null;
  }

  return {
    id,
    label: label ?? id,
    builtin: input.builtin === true,
    createdAt: normalizeTimestamp(input.createdAt),
    updatedAt: normalizeTimestamp(input.updatedAt)
  };
}

export function createCategoryDefinitionFromLabel(label, { builtin = false, now = new Date().toISOString() } = {}) {
  const normalizedLabel = normalizeCategoryLabel(label);

  if (!normalizedLabel || RESERVED_CATEGORY_IDS.has(normalizedLabel)) {
    return null;
  }

  return {
    id: normalizedLabel,
    label: normalizedLabel,
    builtin,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeCategoryDefinitions(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? normalizeCategoryDefinition({ id: value, label: value }) : normalizeCategoryDefinition(value)))
    .filter(Boolean);
}

function createCategoryDefinitionFromMemoCategory(category) {
  const id = normalizeCategory(category);

  if (!id || RESERVED_CATEGORY_IDS.has(id)) {
    return null;
  }

  return {
    id,
    label: MEMO_CATEGORY_LABELS[id] ?? id,
    builtin: MEMO_CATEGORIES.includes(id),
    createdAt: DEFAULT_CATEGORY_TIMESTAMP,
    updatedAt: DEFAULT_CATEGORY_TIMESTAMP
  };
}

export function mergeCategoryDefinitions(...categoryGroups) {
  const categoriesById = new Map();

  for (const categoryGroup of categoryGroups) {
    if (!Array.isArray(categoryGroup)) {
      continue;
    }

    for (const category of categoryGroup) {
      const normalized = normalizeCategoryDefinition(category);

      if (!normalized || categoriesById.has(normalized.id)) {
        continue;
      }

      categoriesById.set(normalized.id, normalized);
    }
  }

  return Array.from(categoriesById.values()).sort(compareCategoryDefinitions);
}

function compareCategoryDefinitions(left, right) {
  if (left.builtin !== right.builtin) {
    return left.builtin ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "ko-KR");
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
  const payload = parsed && typeof parsed === "object" ? parsed : {};
  const memos = Array.isArray(payload.memos)
    ? sortMemosByUpdatedAt(payload.memos.map(normalizeMemo))
    : Array.isArray(payload.notes)
      ? sortMemosByUpdatedAt(payload.notes.map(normalizeMemo))
      : [];
  const memoCategories = memos.map((memo) => createCategoryDefinitionFromMemoCategory(memo.category)).filter(Boolean);

  if (Array.isArray(payload.memos)) {
    return {
      version: MEMO_STORE_VERSION,
      memos,
      categories: mergeCategoryDefinitions(createBuiltinCategoryDefinitions(), normalizeCategoryDefinitions(payload.categories), memoCategories)
    };
  }

  if (Array.isArray(payload.notes)) {
    return {
      version: MEMO_STORE_VERSION,
      memos,
      categories: mergeCategoryDefinitions(createBuiltinCategoryDefinitions(), normalizeCategoryDefinitions(payload.categories), memoCategories)
    };
  }

  return {
    version: MEMO_STORE_VERSION,
    memos: [],
    categories: createBuiltinCategoryDefinitions()
  };
}
