import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import { createInitialComposeSession } from "../domain/compose-session";
import type { ComposeSession } from "../domain/compose-session";
import { matchesQuery } from "../domain/note";
import type { Note } from "../domain/note";
import type { ContextSearchState, SidebarSearchMode, SidebarSurface, SidebarView } from "../domain/workspace";

type CloseTransformSession = (options: { clearDraft: boolean; clearPrompt: boolean; clearFeedback: boolean }) => void;

type UseSidebarSearchControllerParams = {
  closeActiveTransformSession: CloseTransformSession;
  closeFindBar: (options?: { restoreEditorFocus?: boolean }) => void;
  scopedNotes: Note[];
  selectedNote: Note | null;
  sidebarSearchMode: SidebarSearchMode;
  sidebarView: SidebarView;
  setActiveSidebarSurface: Dispatch<SetStateAction<SidebarSurface>>;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setStatusMessage: (message: string) => void;
};

export function useSidebarSearchController(params: UseSidebarSearchControllerParams) {
  return {
    handleSearch: (nextQuery: string) => handleSearch(nextQuery, params)
  };
}

function handleSearch(nextQuery: string, params: UseSidebarSearchControllerParams) {
  const trimmedQuery = nextQuery.trim();
  const matchingNotes = params.scopedNotes.filter((note) => matchesQuery(note, nextQuery));

  resetSearchSideEffects(nextQuery, params);

  if (params.sidebarSearchMode === "ai-context") {
    handleContextSearchQuery(nextQuery, trimmedQuery, params);
    return;
  }

  handleKeywordSearchQuery(nextQuery, trimmedQuery, matchingNotes, params);
}

function resetSearchSideEffects(nextQuery: string, params: UseSidebarSearchControllerParams) {
  params.setQuery(nextQuery);
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.closeFindBar({ restoreEditorFocus: false });
  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  params.setComposeSession(createInitialComposeSession());
  params.setContextSearch((currentSearch) => ({ ...currentSearch, results: [], hasSearched: false, isLoading: false }));
}

function handleContextSearchQuery(nextQuery: string, trimmedQuery: string, params: UseSidebarSearchControllerParams) {
  params.setActiveSidebarSurface("ai-context");
  params.setContextSearch((currentSearch) => ({ ...currentSearch, query: nextQuery }));

  if (!trimmedQuery) {
    params.setStatusMessage("AI 문맥 검색 프롬프트를 비웠어요.");
  }
}

function handleKeywordSearchQuery(
  nextQuery: string,
  trimmedQuery: string,
  matchingNotes: Note[],
  params: UseSidebarSearchControllerParams
) {
  params.setActiveSidebarSurface("notes");

  if (!trimmedQuery) {
    restoreSelectedNote(params);
    return;
  }

  params.setStatusMessage(getKeywordSearchMessage(nextQuery, trimmedQuery, matchingNotes, params));
}

function restoreSelectedNote(params: UseSidebarSearchControllerParams) {
  if (params.selectedNote) {
    params.setSelectedNoteId(params.selectedNote.id);
  }

  params.setStatusMessage(params.sidebarView === "favorites" ? "즐겨찾기 목록을 다시 보고 있어요." : "전체 메모를 다시 보고 있어요.");
}

function getKeywordSearchMessage(nextQuery: string, trimmedQuery: string, matchingNotes: Note[], { selectedNote }: UseSidebarSearchControllerParams) {
  if (selectedNote && matchesQuery(selectedNote, nextQuery)) {
    return `"${trimmedQuery}" 검색 결과 ${matchingNotes.length}개 안에서도 현재 메모를 그대로 보고 있어요.`;
  }

  if (matchingNotes.length > 0) {
    return `"${trimmedQuery}" 검색 결과가 ${matchingNotes.length}개 있어요. 목록에서 메모를 골라주세요.`;
  }

  return `"${trimmedQuery}"에 맞는 메모를 찾지 못했어요.`;
}
