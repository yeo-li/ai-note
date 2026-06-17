import type { Dispatch, SetStateAction } from "react";
import type { MemoCategory, MemoCreateInput, MemoId } from "@ai-note/shared/memo";
import { normalizeMemoCheckboxSyntax } from "@ai-note/shared/memo";
import { buildMemoTitleFromBody } from "../note-content";
import {
  createNote,
  nowStamp,
  toMemoUpdateInput,
  toNoteFromMemo
} from "../domain/note";
import type { Note } from "../domain/note";
import type { SidebarView } from "../domain/workspace";
import type { TransformSession } from "../domain/transform";
import {
  createMemo,
  isMemoRepositoryAvailable,
  updateMemo
} from "../infrastructure/memo-repository";
import {
  canOpenStickyNoteWindow,
  openStickyNoteWindow
} from "../infrastructure/desktop-window";

type NoteMutationParams = {
  activeNote: Note | null;
  categoryFilter?: MemoCategory | "all";
  hasQuery: boolean;
  isMutationLocked: boolean;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setSidebarView: Dispatch<SetStateAction<SidebarView>>;
  setStatusMessage: (message: string) => void;
};

type PatchActiveNoteParams = NoteMutationParams & {
  updateActiveTransformSession: (updater: (session: TransformSession) => TransformSession | null) => void;
};

export function useNoteMutationActions(params: NoteMutationParams) {
  return {
    handleCreateNote: () => createAndSelectNote(params),
    handleCreateStickyNoteWindow: () => createStickyNoteWindow(params),
    switchSidebarView: (nextView: SidebarView) => switchSidebarView(nextView, params),
    toggleFavorite: (noteId: MemoId) => toggleFavorite(noteId, params)
  };
}

export function patchActiveNoteWithPersistence(update: Partial<Note>, message: string | undefined, params: PatchActiveNoteParams) {
  if (!canPatchActiveNote(params)) {
    return;
  }

  const activeNote = params.activeNote;
  if (!activeNote) return;
  const normalizedUpdate = normalizeNotePatch(update);
  applyLocalNotePatch(activeNote, normalizedUpdate, params);
  resetNoteTransientState(params);
  persistNotePatch(activeNote.id, normalizedUpdate, params.setStatusMessage);
  if (message) params.setStatusMessage(message);
}

function normalizeNotePatch(update: Partial<Note>) {
  return typeof update.body === "string"
    ? { ...update, body: normalizeMemoCheckboxSyntax(update.body) }
    : update;
}

function canPatchActiveNote(params: PatchActiveNoteParams) {
  if (!params.isMutationLocked) {
    return Boolean(params.activeNote);
  }

  params.setStatusMessage("저장소 연결이 복구될 때까지 편집이 잠겨 있어요.");
  return false;
}

function applyLocalNotePatch(activeNote: Note, update: Partial<Note>, params: PatchActiveNoteParams) {
  const stamp = typeof update.body === "string" ? nowStamp() : null;
  params.setNotes((currentNotes) => currentNotes.map((note) => patchMatchingNote(note, activeNote.id, update, stamp)));
}

function patchMatchingNote(note: Note, activeNoteId: MemoId, update: Partial<Note>, stamp: ReturnType<typeof nowStamp> | null) {
  if (note.id !== activeNoteId) {
    return note;
  }

  return {
    ...note,
    ...update,
    updatedAt: stamp?.updatedAt ?? note.updatedAt,
    dateLabel: update.dateLabel ?? stamp?.dateLabel ?? note.dateLabel
  };
}

function resetNoteTransientState(params: PatchActiveNoteParams) {
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.updateActiveTransformSession((session) => ({ ...session, draft: null, feedback: null }));
}

function persistNotePatch(noteId: MemoId, update: Partial<Note>, setStatusMessage: (message: string) => void) {
  const persistencePatch = toMemoUpdateInput(update);

  if (!isMemoRepositoryAvailable() || Object.keys(persistencePatch).length === 0) {
    return;
  }

  void updateMemo(noteId, persistencePatch).catch(() => {
    setStatusMessage("메모 변경을 저장소에 반영하지 못했어요.");
  });
}

function switchSidebarView(nextView: SidebarView, params: NoteMutationParams) {
  params.setSidebarView(nextView);
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.setStatusMessage(getSidebarViewMessage(nextView, params.hasQuery));
}

function getSidebarViewMessage(nextView: SidebarView, hasQuery: boolean) {
  if (nextView === "favorites") {
    return "즐겨찾기 메모만 보고 있어요.";
  }

  return hasQuery ? "현재 검색어 기준으로 전체 메모를 다시 보고 있어요." : "전체 메모를 보고 있어요.";
}

async function toggleFavorite(noteId: MemoId, params: NoteMutationParams) {
  const targetNote = params.activeNote?.id === noteId ? params.activeNote : null;
  const nextFavorite = targetNote ? !targetNote.favorite : null;

  if (nextFavorite === null) {
    return;
  }

  applyFavoriteState(noteId, nextFavorite, params);
  persistFavoriteState(noteId, nextFavorite, params.setStatusMessage);
}

function applyFavoriteState(noteId: MemoId, nextFavorite: boolean, params: NoteMutationParams) {
  params.setNotes((currentNotes) => currentNotes.map((note) => note.id === noteId ? { ...note, favorite: nextFavorite } : note));
  params.setNoteMenuId(null);
  params.setStatusMessage(nextFavorite ? "즐겨찾기에 추가했어요." : "즐겨찾기에서 뺐어요.");
}

function persistFavoriteState(noteId: MemoId, nextFavorite: boolean, setStatusMessage: (message: string) => void) {
  if (!isMemoRepositoryAvailable()) {
    return;
  }

  void updateMemo(noteId, { favorite: nextFavorite }).catch(() => {
    setStatusMessage("즐겨찾기 상태를 저장소에 반영하지 못했어요.");
  });
}

async function createAndSelectNote(params: NoteMutationParams) {
  if (!canCreateNote(params, "새 메모를 만들 수 없어요.")) {
    return;
  }

  const nextNote = await createPersistedNote("새 메모를 만들지 못했어요.", params.setStatusMessage, params.categoryFilter);
  if (!nextNote) return;
  insertNote(nextNote, params);
  params.setSelectedNoteId(nextNote.id);
  params.setQuery("");
  resetNoteMenuState(params);
  params.setStatusMessage("새 메모를 만들고 바로 편집할 수 있게 열어두었어요.");
}

async function createStickyNoteWindow(params: NoteMutationParams) {
  if (!canCreateStickyNote(params)) {
    return;
  }

  const nextNote = await createPersistedNote("새 스티커 메모를 만들지 못했어요.", params.setStatusMessage, params.categoryFilter);
  if (!nextNote) return;
  insertNote(nextNote, params);
  await openCreatedStickyNote(nextNote.id, params.setStatusMessage);
}

function canCreateNote(params: NoteMutationParams, actionText: string) {
  if (!params.isMutationLocked) {
    return true;
  }

  params.setStatusMessage(`저장소 연결이 복구될 때까지 ${actionText}`);
  return false;
}

function canCreateStickyNote(params: NoteMutationParams) {
  if (!canCreateNote(params, "새 스티커 메모를 만들 수 없어요.")) return false;
  if (canOpenStickyNoteWindow()) return true;
  params.setStatusMessage("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있어요.");
  return false;
}

async function createPersistedNote(errorMessage: string, setStatusMessage: (message: string) => void, categoryFilter?: MemoCategory | "all") {
  let nextNote = createNoteInCurrentCategory(categoryFilter);

  if (!isMemoRepositoryAvailable()) {
    return nextNote;
  }

  try {
    nextNote = toNoteFromMemo(await createMemo(toCreateInput(nextNote)));
    return nextNote;
  } catch {
    setStatusMessage(errorMessage);
    return null;
  }
}

function toCreateInput(note: Note): MemoCreateInput {
  return {
    title: buildMemoTitleFromBody(note.body),
    body: note.body,
    category: note.category,
    color: note.color
  };
}

function createNoteInCurrentCategory(categoryFilter?: MemoCategory | "all") {
  return {
    ...createNote(),
    category: categoryFilter && categoryFilter !== "all" ? categoryFilter : null
  };
}

function insertNote(nextNote: Note, params: NoteMutationParams) {
  params.setNotes((currentNotes) => [nextNote, ...currentNotes.filter((note) => note.id !== nextNote.id)]);
}

function resetNoteMenuState(params: NoteMutationParams) {
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
}

async function openCreatedStickyNote(noteId: MemoId, setStatusMessage: (message: string) => void) {
  try {
    await openStickyNoteWindow(noteId);
    setStatusMessage("새 스티커 메모를 추가했어요.");
  } catch {
    setStatusMessage("새 스티커 메모 창을 열지 못했어요.");
  }
}
