import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoCategory, MemoCategoryDefinition, MemoId } from "@ai-note/shared/memo";
import { createDefaultCategoryDefinitions, hasCategoryDuplicate, mergeCategoryDefinitions, normalizeCategoryDraft } from "../domain/categories";
import type { Note } from "../domain/note";
import {
  categorizeMemo,
  createMemoCategory,
  getCategorizingMemoIds,
  isMemoRepositoryAvailable,
  listMemoCategories,
  subscribeToCategorizeState,
  updateMemo
} from "../infrastructure/memo-repository";

export type CategoryFilter = MemoCategory | "all";

type UseMemoCategoryControllerParams = {
  isMutationLocked: boolean;
  notes: Note[];
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setStatusMessage: (message: string) => void;
};

export function useMemoCategoryController(params: UseMemoCategoryControllerParams) {
  const [categorizingNoteIds, setCategorizingNoteIds] = useState<Record<MemoId, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [categories, setCategories] = useState<MemoCategoryDefinition[]>(createDefaultCategoryDefinitions);

  useCategorizeState(setCategorizingNoteIds);
  useCategoryList(setCategories);

  return {
    categorizingNoteIds,
    categories,
    categoryFilter,
    setCategoryFilter,
    createCategory: (label: string) => createCategory(label, { ...params, categories, setCategories, setCategoryFilter }),
    setNoteCategory: (noteId: MemoId, category: MemoCategory | null) => setNoteCategory(noteId, category, params),
    runAiCategorize: (noteId: MemoId) => runAiCategorize(noteId, params)
  };
}

function useCategoryList(setCategories: Dispatch<SetStateAction<MemoCategoryDefinition[]>>) {
  useEffect(() => {
    let cancelled = false;
    void hydrateCategories(setCategories, () => cancelled);

    return () => {
      cancelled = true;
    };
  }, [setCategories]);
}

async function hydrateCategories(setCategories: Dispatch<SetStateAction<MemoCategoryDefinition[]>>, isCancelled: () => boolean) {
  if (!isMemoRepositoryAvailable()) {
    return;
  }

  try {
    const storedCategories = await listMemoCategories();
    if (isCancelled()) return;
    setCategories(mergeCategoryDefinitions(createDefaultCategoryDefinitions(), storedCategories));
  } catch {
    if (isCancelled()) return;
    setCategories(createDefaultCategoryDefinitions());
  }
}

function useCategorizeState(setCategorizingNoteIds: Dispatch<SetStateAction<Record<MemoId, boolean>>>) {
  useEffect(() => {
    let cancelled = false;
    void hydrateCategorizingNoteIds(setCategorizingNoteIds, () => cancelled);
    const unsubscribe = subscribeToCategorizeState(({ memoId, busy }) => updateCategorizingNote(setCategorizingNoteIds, memoId, busy));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setCategorizingNoteIds]);
}

async function hydrateCategorizingNoteIds(setCategorizingNoteIds: Dispatch<SetStateAction<Record<MemoId, boolean>>>, isCancelled: () => boolean) {
  const memoIds = await getCategorizingMemoIds();
  if (isCancelled()) return;
  setCategorizingNoteIds(Object.fromEntries(memoIds.map((memoId) => [memoId, true])));
}

function updateCategorizingNote(setCategorizingNoteIds: Dispatch<SetStateAction<Record<MemoId, boolean>>>, memoId: MemoId, busy: boolean) {
  setCategorizingNoteIds((currentNoteIds) => {
    if (busy) {
      return { ...currentNoteIds, [memoId]: true };
    }

    const nextNoteIds = { ...currentNoteIds };
    delete nextNoteIds[memoId];
    return nextNoteIds;
  });
}

function applyNoteCategory(setNotes: Dispatch<SetStateAction<Note[]>>, noteId: MemoId, category: MemoCategory | null) {
  setNotes((currentNotes) => currentNotes.map((note) => (note.id === noteId ? { ...note, category } : note)));
}

type CreateCategoryParams = UseMemoCategoryControllerParams & {
  categories: MemoCategoryDefinition[];
  setCategories: Dispatch<SetStateAction<MemoCategoryDefinition[]>>;
  setCategoryFilter: Dispatch<SetStateAction<CategoryFilter>>;
};

async function createCategory(label: string, params: CreateCategoryParams) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 카테고리를 추가할 수 없어요.");
    return null;
  }

  const normalizedLabel = normalizeCategoryDraft(label);

  if (!normalizedLabel) {
    params.setStatusMessage("카테고리 이름을 입력해 주세요.");
    return null;
  }

  if (hasCategoryDuplicate(params.categories, normalizedLabel)) {
    params.setStatusMessage("이미 있는 카테고리입니다.");
    return null;
  }

  if (!isMemoRepositoryAvailable()) {
    params.setStatusMessage("카테고리 저장소를 찾지 못했어요.");
    return null;
  }

  try {
    const createdCategory = await createMemoCategory({ label: normalizedLabel });
    params.setCategories((currentCategories) => mergeCategoryDefinitions(createDefaultCategoryDefinitions(), currentCategories, [createdCategory]));
    params.setCategoryFilter(createdCategory.id);
    params.setStatusMessage("카테고리를 추가했어요.");
    return createdCategory;
  } catch {
    params.setStatusMessage("카테고리를 저장하지 못했어요.");
    return null;
  }
}

async function setNoteCategory(noteId: MemoId, category: MemoCategory | null, params: UseMemoCategoryControllerParams) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 카테고리를 변경할 수 없어요.");
    return;
  }

  const previousCategory = params.notes.find((note) => note.id === noteId)?.category ?? null;
  applyNoteCategory(params.setNotes, noteId, category);

  if (!isMemoRepositoryAvailable()) {
    return;
  }

  try {
    const updatedMemo = await updateMemo(noteId, { category });

    if (!updatedMemo) {
      applyNoteCategory(params.setNotes, noteId, previousCategory);
      params.setStatusMessage("카테고리를 저장할 메모를 찾지 못했어요.");
      return;
    }

    applyNoteCategory(params.setNotes, noteId, updatedMemo.category);
    params.setStatusMessage("카테고리를 저장했어요.");
  } catch {
    applyNoteCategory(params.setNotes, noteId, previousCategory);
    params.setStatusMessage("카테고리 변경을 저장소에 반영하지 못했어요.");
  }
}

async function runAiCategorize(noteId: MemoId, params: UseMemoCategoryControllerParams) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 AI 분류를 실행할 수 없어요.");
    return;
  }

  if (!isMemoRepositoryAvailable()) {
    params.setStatusMessage("AI 분류 브리지를 찾지 못했어요.");
    return;
  }

  params.setStatusMessage("AI가 메모를 분류하고 있어요.");

  try {
    const updatedMemo = await categorizeMemo(noteId);

    if (!updatedMemo) {
      params.setStatusMessage("메모를 찾지 못해 분류하지 못했어요.");
      return;
    }

    applyNoteCategory(params.setNotes, noteId, updatedMemo.category);
    params.setStatusMessage("AI가 메모 카테고리를 정했어요.");
  } catch {
    params.setStatusMessage("AI 분류 요청에 실패했어요.");
  }
}
