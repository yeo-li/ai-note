export const MEMO_CATEGORIES = ["idea", "task", "journal", "reference", "other"];

export const MEMO_CATEGORY_LABELS = {
  idea: "아이디어",
  task: "할 일",
  journal: "회고",
  reference: "정보",
  other: "기타"
};

export function normalizeMemoCategoryValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized.slice(0, 32) : null;
}

export function getMemoCategoryLabel(category) {
  if (typeof category !== "string" || category.length === 0) {
    return "";
  }

  return MEMO_CATEGORY_LABELS[category] ?? category;
}
