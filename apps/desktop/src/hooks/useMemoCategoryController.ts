import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoCategory, MemoId } from "@ai-note/shared/memo";
import type { Note } from "../domain/note";
import {
  categorizeMemo,
  getCategorizingMemoIds,
  isMemoRepositoryAvailable,
  subscribeToCategorizeState,
  updateMemo
} from "../infrastructure/memo-repository";

export type CategoryFilter = MemoCategory | "all";

type UseMemoCategoryControllerParams = {
  isMutationLocked: boolean;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setStatusMessage: (message: string) => void;
};

export function useMemoCategoryController(params: UseMemoCategoryControllerParams) {
  const [categorizingNoteIds, setCategorizingNoteIds] = useState<Record<MemoId, boolean>>({});
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useCategorizeState(setCategorizingNoteIds);

  return {
    categorizingNoteIds,
    categoryFilter,
    setCategoryFilter,
    setNoteCategory: (noteId: MemoId, category: MemoCategory | null) => setNoteCategory(noteId, category, params),
    runAiCategorize: (noteId: MemoId) => runAiCategorize(noteId, params)
  };
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

async function setNoteCategory(noteId: MemoId, category: MemoCategory | null, params: UseMemoCategoryControllerParams) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 카테고리를 변경할 수 없어요.");
    return;
  }

  applyNoteCategory(params.setNotes, noteId, category);

  if (!isMemoRepositoryAvailable()) {
    return;
  }

  try {
    await updateMemo(noteId, { category });
  } catch {
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
