import { MEMO_CATEGORIES, getMemoCategoryLabel, normalizeMemoCategoryValue } from "@ai-note/shared/memo";
import type { MemoCategory, MemoCategoryDefinition } from "@ai-note/shared/memo";
import type { Note } from "./note";

const defaultCategoryTimestamp = "1970-01-01T00:00:00.000Z";

export function createDefaultCategoryDefinitions(): MemoCategoryDefinition[] {
  return MEMO_CATEGORIES.map((category) => ({
    id: category,
    label: getMemoCategoryLabel(category),
    description: "",
    builtin: true,
    createdAt: defaultCategoryTimestamp,
    updatedAt: defaultCategoryTimestamp
  }));
}

export function mergeCategoryDefinitions(...categoryGroups: MemoCategoryDefinition[][]) {
  const categoriesById = new Map<MemoCategory, MemoCategoryDefinition>();

  for (const categories of categoryGroups) {
    for (const category of categories) {
      if (!category.id || categoriesById.has(category.id)) {
        continue;
      }

      categoriesById.set(category.id, category);
    }
  }

  return Array.from(categoriesById.values()).sort(compareCategoryDefinitions);
}

export function createNoteCategoryDefinitions(notes: Note[]): MemoCategoryDefinition[] {
  return notes
    .map((note) => note.category)
    .filter((category): category is MemoCategory => Boolean(category))
    .map((category) => ({
      id: category,
      label: getMemoCategoryLabel(category),
      description: "",
      builtin: MEMO_CATEGORIES.includes(category),
      createdAt: defaultCategoryTimestamp,
      updatedAt: defaultCategoryTimestamp
    }));
}

export function getCategoryDisplayLabel(categories: MemoCategoryDefinition[], category: MemoCategory) {
  return categories.find((candidate) => candidate.id === category)?.label ?? getMemoCategoryLabel(category);
}

export function normalizeCategoryDraft(value: string) {
  const category = normalizeMemoCategoryValue(value);
  return category && category !== "all" ? category : null;
}

export function hasCategoryDuplicate(categories: MemoCategoryDefinition[], label: string) {
  const normalized = normalizeCategoryDraft(label);

  if (!normalized) {
    return false;
  }

  const normalizedLabel = normalized.toLocaleLowerCase("ko-KR");
  return categories.some((category) => category.id === normalized || category.label.toLocaleLowerCase("ko-KR") === normalizedLabel);
}

function compareCategoryDefinitions(left: MemoCategoryDefinition, right: MemoCategoryDefinition) {
  if (left.builtin !== right.builtin) {
    return left.builtin ? -1 : 1;
  }

  return left.label.localeCompare(right.label, "ko-KR");
}
