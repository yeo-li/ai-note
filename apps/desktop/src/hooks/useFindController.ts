import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { findMatchesInBody } from "../domain/note";
import type { Note } from "../domain/note";

type CloseTransformSession = (options: { clearDraft: boolean; clearPrompt: boolean; clearFeedback: boolean }) => void;
type FindMatch = { start: number; end: number };

type UseFindControllerParams = {
  activeNote: Note | null;
  isStickyMode: boolean;
  noteBodyInputRef: RefObject<HTMLTextAreaElement>;
  closeActiveTransformSession: CloseTransformSession;
  setStatusMessage: (message: string) => void;
};

type FindControllerState = {
  committedFindQuery: string;
  findInputRef: RefObject<HTMLInputElement>;
  findMatches: FindMatch[];
  findMatchIndex: number;
  findQuery: string;
  isFindBarOpen: boolean;
  setCommittedFindQuery: Dispatch<SetStateAction<string>>;
  setFindMatchIndex: Dispatch<SetStateAction<number>>;
  setFindQuery: Dispatch<SetStateAction<string>>;
  setIsFindBarOpen: Dispatch<SetStateAction<boolean>>;
};

export function useFindController(params: UseFindControllerParams) {
  const state = useFindControllerState(params.activeNote?.body ?? "");

  useFindControllerEffects(params, state);

  return createFindControllerResult(params, state);
}

function useFindControllerState(noteBody: string): FindControllerState {
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [committedFindQuery, setCommittedFindQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findMatches = useMemo(() => findMatchesInBody(noteBody, committedFindQuery), [committedFindQuery, noteBody]);

  return { committedFindQuery, findInputRef, findMatches, findMatchIndex, findQuery, isFindBarOpen, setCommittedFindQuery, setFindMatchIndex, setFindQuery, setIsFindBarOpen };
}

function useFindControllerEffects(params: UseFindControllerParams, state: FindControllerState) {
  useResetFindOnNoteChange(params.activeNote?.id, state);
  useFindInputFocus(state.isFindBarOpen, state.findInputRef);
  useFindMatchIndexGuard(state);
  useSelectedFindMatch(params.activeNote, state, params.noteBodyInputRef);
  useFindShortcut(() => openFindBar(params, state));
}

function createFindControllerResult(params: UseFindControllerParams, state: FindControllerState) {
  return {
    committedFindQuery: state.committedFindQuery,
    findInputRef: state.findInputRef,
    findMatches: state.findMatches,
    findMatchIndex: state.findMatchIndex,
    findQuery: state.findQuery,
    isFindBarOpen: state.isFindBarOpen,
    setFindQuery: state.setFindQuery,
    openFindBar: () => openFindBar(params, state),
    closeFindBar: (options?: { restoreEditorFocus?: boolean }) => closeFindBar(params, state, options),
    searchFind: (direction: 1 | -1) => searchFind(params, state, direction)
  };
}

function useResetFindOnNoteChange(activeNoteId: string | undefined, state: FindControllerState) {
  const { setCommittedFindQuery, setFindMatchIndex, setFindQuery, setIsFindBarOpen } = state;

  useEffect(() => {
    setIsFindBarOpen(false);
    setFindQuery("");
    setCommittedFindQuery("");
    setFindMatchIndex(0);
  }, [activeNoteId, setCommittedFindQuery, setFindMatchIndex, setFindQuery, setIsFindBarOpen]);
}

function useFindInputFocus(isFindBarOpen: boolean, findInputRef: RefObject<HTMLInputElement>) {
  useEffect(() => {
    if (!isFindBarOpen) {
      return;
    }

    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findInputRef, isFindBarOpen]);
}

function useFindMatchIndexGuard(state: FindControllerState) {
  const { findMatchIndex, findMatches, isFindBarOpen, setFindMatchIndex } = state;

  useEffect(() => {
    if (!isFindBarOpen || findMatches.length === 0) {
      setFindMatchIndex(0);
      return;
    }

    if (findMatchIndex >= findMatches.length) {
      setFindMatchIndex(0);
    }
  }, [findMatchIndex, findMatches.length, isFindBarOpen, setFindMatchIndex]);
}

function useSelectedFindMatch(activeNote: Note | null, state: FindControllerState, noteBodyInputRef: RefObject<HTMLTextAreaElement>) {
  const { findMatchIndex, findMatches, isFindBarOpen } = state;

  useEffect(() => {
    if (!isFindBarOpen || !activeNote || findMatches.length === 0) {
      return;
    }

    const target = findMatches[findMatchIndex] ?? findMatches[0];
    noteBodyInputRef.current?.focus();
    noteBodyInputRef.current?.setSelectionRange(target.start, target.end);
  }, [activeNote, findMatchIndex, findMatches, isFindBarOpen, noteBodyInputRef]);
}

function useFindShortcut(openFindBar: () => void) {
  useEffect(() => addFindShortcutListener(openFindBar), [openFindBar]);
}

function addFindShortcutListener(openFindBar: () => void) {
  if (typeof window === "undefined") return;
  const handleKeydown = (event: KeyboardEvent) => handleFindShortcut(event, openFindBar);

  window.addEventListener("keydown", handleKeydown);
  return () => window.removeEventListener("keydown", handleKeydown);
}

function handleFindShortcut(event: KeyboardEvent, openFindBar: () => void) {
  if (!isFindShortcut(event)) return;
  event.preventDefault();
  openFindBar();
}

function isFindShortcut(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";
}

function openFindBar(params: UseFindControllerParams, state: FindControllerState) {
  if (!params.activeNote || params.isStickyMode) {
    params.setStatusMessage("지금은 메모 본문 찾기를 열 수 없어요.");
    return;
  }

  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  state.setIsFindBarOpen(true);
  params.setStatusMessage("메모 안에서 찾기를 열었어요.");
}

function closeFindBar(params: UseFindControllerParams, state: FindControllerState, options: { restoreEditorFocus?: boolean } = {}) {
  const { restoreEditorFocus = true } = options;
  state.setIsFindBarOpen(false);
  state.setFindQuery("");
  state.setCommittedFindQuery("");
  state.setFindMatchIndex(0);
  if (restoreEditorFocus) params.noteBodyInputRef.current?.focus();
  params.setStatusMessage("메모 안에서 찾기를 닫았어요.");
}

function searchFind(params: UseFindControllerParams, state: FindControllerState, direction: 1 | -1) {
  const trimmedQuery = state.findQuery.trim();

  if (trimmedQuery.length === 0) {
    return;
  }

  if (trimmedQuery !== state.committedFindQuery.trim()) {
    state.setCommittedFindQuery(state.findQuery);
    state.setFindMatchIndex(0);

    const matches = findMatchesInBody(params.activeNote?.body ?? "", state.findQuery);
    if (matches.length === 0) {
      params.setStatusMessage(`"${trimmedQuery}"을 찾지 못했어요.`);
    } else {
      params.setStatusMessage(`"${trimmedQuery}" 검색 결과 ${matches.length}개를 찾았어요.`);
    }
    return;
  }

  moveFindMatch(params, state, direction);
}

function moveFindMatch(params: UseFindControllerParams, state: FindControllerState, direction: 1 | -1) {
  if (state.findMatches.length === 0) {
    params.setStatusMessage(`"${state.committedFindQuery.trim()}"을 찾지 못했어요.`);
    return;
  }

  state.setFindMatchIndex((currentIndex) => (currentIndex + direction + state.findMatches.length) % state.findMatches.length);
  params.setStatusMessage(`"${state.committedFindQuery.trim()}" 검색 결과 ${state.findMatches.length}개 중에서 이동하고 있어요.`);
}
