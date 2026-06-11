import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import type { ContextSearchState, SidebarSearchMode, SidebarSurface } from "../domain/workspace";
import { toErrorMessage } from "../domain/storage-status";
import {
  isMemoRepositoryAvailable,
  searchMemosByContext
} from "../infrastructure/memo-repository";

const minContextSearchLoadingMs = 320;

type UseContextSearchControllerParams = {
  closeActiveTransformSession: (options: { clearDraft: boolean; clearPrompt: boolean; clearFeedback: boolean }) => void;
  closeFindBar: (options?: { restoreEditorFocus?: boolean }) => void;
  setActiveSidebarSurface: Dispatch<SetStateAction<SidebarSurface>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setSidebarSearchMode: Dispatch<SetStateAction<SidebarSearchMode>>;
  setStatusMessage: (message: string) => void;
};

type ContextSearchControllerContext = UseContextSearchControllerParams & {
  contextSearch: ContextSearchState;
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>;
};

export function useContextSearchController(params: UseContextSearchControllerParams) {
  const [contextSearch, setContextSearch] = useState<ContextSearchState>(createInitialContextSearch);
  const context = { ...params, contextSearch, setContextSearch };

  return { contextSearch, setContextSearch, openContextSearchPanel: () => openContextSearchPanel(context), closeContextSearchPanel: () => closeContextSearchPanel(context), runContextSearch: () => runContextSearch(context), openNoteFromContextSearch: (noteId: MemoId) => openNoteFromContextSearch(noteId, context) };
}

function openContextSearchPanel(context: ContextSearchControllerContext) {
  resetCompetingSurfaces(context);
  context.setActiveSidebarSurface("ai-context");
  context.setContextSearch((currentSearch) => ({ ...currentSearch }));
  context.setStatusMessage("문맥 검색 입력창을 열어두었어요.");
}

function closeContextSearchPanel(context: ContextSearchControllerContext) {
  context.setSidebarSearchMode("keyword");
  context.setActiveSidebarSurface("notes");
  context.setContextSearch((currentSearch) => resetContextSearchResults(currentSearch));
  context.setStatusMessage("문맥 검색 입력창을 닫았어요.");
}

async function runContextSearch(context: ContextSearchControllerContext) {
  const trimmedQuery = context.contextSearch.query.trim();
  if (!canRunContextSearch(trimmedQuery, context.setContextSearch, context.setStatusMessage)) return;
  await executeContextSearch(trimmedQuery, context.setContextSearch, context.setStatusMessage);
}

function openNoteFromContextSearch(noteId: MemoId, context: ContextSearchControllerContext) {
  context.setSelectedNoteId(noteId);
  context.setDeleteIntentId(null);
  context.setNoteMenuId(null);
  context.setStatusMessage("문맥 검색 결과에서 메모를 열었어요.");
}

function createInitialContextSearch(): ContextSearchState {
  return {
    query: "",
    results: [],
    hasSearched: false,
    isLoading: false
  };
}

function resetCompetingSurfaces(params: UseContextSearchControllerParams) {
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.closeFindBar();
  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
}

function resetContextSearchResults(currentSearch: ContextSearchState): ContextSearchState {
  return {
    ...currentSearch,
    results: [],
    hasSearched: false,
    isLoading: false
  };
}

function canRunContextSearch(
  trimmedQuery: string,
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>,
  setStatusMessage: (message: string) => void
) {
  if (!trimmedQuery) return rejectBlankContextSearch(setContextSearch, setStatusMessage);
  if (!isMemoRepositoryAvailable()) return rejectUnavailableContextSearch(setStatusMessage);
  return true;
}

function rejectBlankContextSearch(setContextSearch: Dispatch<SetStateAction<ContextSearchState>>, setStatusMessage: (message: string) => void) {
  setContextSearch((currentSearch) => resetContextSearchResults(currentSearch));
  setStatusMessage("AI 맥락 검색어를 입력한 뒤 실행해 주세요.");
  return false;
}

function rejectUnavailableContextSearch(setStatusMessage: (message: string) => void) {
  setStatusMessage("문맥 검색을 실행할 수 있는 memoAPI 브리지를 찾지 못했어요.");
  return false;
}

async function executeContextSearch(
  trimmedQuery: string,
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>,
  setStatusMessage: (message: string) => void
) {
  setContextSearch((currentSearch) => ({ ...currentSearch, isLoading: true, hasSearched: true }));
  const loadingStartedAt = Date.now();
  try {
    await applyContextSearchResults(trimmedQuery, loadingStartedAt, setContextSearch, setStatusMessage);
  } catch (error) {
    applyContextSearchError(error, setContextSearch, setStatusMessage);
  }
}

async function applyContextSearchResults(trimmedQuery: string, loadingStartedAt: number, setContextSearch: Dispatch<SetStateAction<ContextSearchState>>, setStatusMessage: (message: string) => void) {
  const results = await searchMemosByContext(trimmedQuery);
  await waitForMinimumLoading(loadingStartedAt);
  setContextSearch((currentSearch) => ({ ...currentSearch, results, isLoading: false, hasSearched: true }));
  setStatusMessage(getContextSearchResultMessage(trimmedQuery, results.length));
}

function applyContextSearchError(error: unknown, setContextSearch: Dispatch<SetStateAction<ContextSearchState>>, setStatusMessage: (message: string) => void) {
  setContextSearch((currentSearch) => ({ ...currentSearch, results: [], isLoading: false, hasSearched: true }));
  setStatusMessage(toErrorMessage(error));
}

async function waitForMinimumLoading(loadingStartedAt: number) {
  const remainingLoadingMs = minContextSearchLoadingMs - (Date.now() - loadingStartedAt);

  if (remainingLoadingMs <= 0) {
    return;
  }

  await new Promise((resolve) => {
    window.setTimeout(resolve, remainingLoadingMs);
  });
}

function getContextSearchResultMessage(trimmedQuery: string, resultCount: number) {
  if (resultCount > 0) {
    return `AI 맥락 검색 결과 ${resultCount}개를 찾았어요. 이유를 확인하고 메모를 열어보세요.`;
  }

  return `"${trimmedQuery}"와 관련된 메모를 찾지 못했어요.`;
}
