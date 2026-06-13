import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import { deriveNoteHeadline } from "../note-content";
import { computeNextSelectionAfterDelete } from "../domain/note";
import type { Note, NoteBackup } from "../domain/note";
import type { SidebarView } from "../domain/workspace";
import {
  deleteMemo,
  isMemoRepositoryAvailable
} from "../infrastructure/memo-repository";

type CloseTransformSession = (options: { clearDraft: boolean; clearPrompt: boolean; clearFeedback: boolean }) => void;

type UseDeleteNoteControllerParams = {
  activeNote: Note | null;
  closeActiveTransformSession: CloseTransformSession;
  deleteIntentId: MemoId | null;
  filteredNotes: Note[];
  hasQuery: boolean;
  isMutationLocked: boolean;
  noteMenuId: MemoId | null;
  notes: Note[];
  query: string;
  scopedNotes: Note[];
  selectedNoteId: MemoId | "";
  sidebarView: SidebarView;
  setBackups: Dispatch<SetStateAction<Record<MemoId, NoteBackup>>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setStatusMessage: (message: string) => void;
};

export function useDeleteNoteController(params: UseDeleteNoteControllerParams) {
  const deleteTargetNote = getDeleteTargetNote(params);
  const isDeleteModalOpen = Boolean(deleteTargetNote);
  const cancelDelete = () => cancelDeleteNote(params);

  useDeleteModalEscape(isDeleteModalOpen, cancelDelete);
  useNoteMenuVisibility(params);
  useNoteMenuOutsideClose(params.noteMenuId, params.setNoteMenuId);
  return createDeleteNoteControllerResult(deleteTargetNote, isDeleteModalOpen, cancelDelete, params);
}

function createDeleteNoteControllerResult(deleteTargetNote: Note | null, isDeleteModalOpen: boolean, cancelDelete: () => void, params: UseDeleteNoteControllerParams) {
  return {
    deleteTargetHeadline: deleteTargetNote ? deriveNoteHeadline(deleteTargetNote.body) : "",
    deleteTargetNote,
    isDeleteModalOpen,
    beginDeleteNote: (noteId?: MemoId) => beginDeleteNote(noteId, params),
    cancelDeleteNote: cancelDelete,
    confirmDeleteNote: () => confirmDeleteNote(deleteTargetNote, params),
    toggleNoteMenu: (noteId: MemoId) => toggleNoteMenu(noteId, params)
  };
}

function useDeleteModalEscape(isDeleteModalOpen: boolean, cancelDeleteNote: () => void) {
  useEffect(() => {
    if (!isDeleteModalOpen || typeof window === "undefined") return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDeleteNote();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [cancelDeleteNote, isDeleteModalOpen]);
}

function useNoteMenuVisibility(params: UseDeleteNoteControllerParams) {
  useEffect(() => {
    if (!shouldCloseMissingNoteMenu(params)) return;
    params.setNoteMenuId(null);
  }, [params.filteredNotes, params.hasQuery, params.noteMenuId, params.notes, params.sidebarView]);
}

function shouldCloseMissingNoteMenu(params: UseDeleteNoteControllerParams) {
  if (!params.noteMenuId) return false;
  if (!params.notes.some((note) => note.id === params.noteMenuId)) return true;
  return (params.hasQuery || params.sidebarView === "favorites") && !params.filteredNotes.some((note) => note.id === params.noteMenuId);
}

function useNoteMenuOutsideClose(noteMenuId: MemoId | null, setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>) {
  useEffect(() => {
    if (!noteMenuId || typeof window === "undefined") return;
    const closeOnPointer = (event: PointerEvent) => closeNoteMenuOnPointer(event, setNoteMenuId);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNoteMenuId(null);
    };
    window.addEventListener("pointerdown", closeOnPointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => removeNoteMenuListeners(closeOnPointer, closeOnEscape);
  }, [noteMenuId, setNoteMenuId]);
}

function closeNoteMenuOnPointer(event: PointerEvent, setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>) {
  const nextTarget = event.target;
  if (!(nextTarget instanceof Element)) {
    setNoteMenuId(null);
    return;
  }
  if (!nextTarget.closest("[data-note-menu-root='true']")) setNoteMenuId(null);
}

function removeNoteMenuListeners(closeOnPointer: (event: PointerEvent) => void, closeOnEscape: (event: KeyboardEvent) => void) {
  window.removeEventListener("pointerdown", closeOnPointer);
  window.removeEventListener("keydown", closeOnEscape);
}

function getDeleteTargetNote({ deleteIntentId, notes }: UseDeleteNoteControllerParams) {
  return deleteIntentId ? notes.find((note) => note.id === deleteIntentId) ?? null : null;
}

function beginDeleteNote(noteId: MemoId | undefined, params: UseDeleteNoteControllerParams) {
  if (!canBeginDelete(params)) {
    return;
  }

  const targetNote = getBeginDeleteTarget(noteId, params);
  if (!targetNote) return;
  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  params.setNoteMenuId(null);
  params.setDeleteIntentId(targetNote.id);
  params.setStatusMessage(`"${deriveNoteHeadline(targetNote.body)}" 메모를 삭제할까요?`);
}

function canBeginDelete(params: UseDeleteNoteControllerParams) {
  if (!params.isMutationLocked) {
    return true;
  }

  params.setStatusMessage("저장소 연결이 복구될 때까지 삭제할 수 없어요.");
  return false;
}

function getBeginDeleteTarget(noteId: MemoId | undefined, params: UseDeleteNoteControllerParams) {
  const targetNote = noteId ? params.notes.find((note) => note.id === noteId) ?? null : params.activeNote;

  if (noteId && !targetNote) {
    params.setNoteMenuId(null);
    params.setStatusMessage("삭제할 메모를 찾지 못했어요.");
  }

  return targetNote;
}

function cancelDeleteNote(params: UseDeleteNoteControllerParams) {
  params.setDeleteIntentId(null);
  params.setStatusMessage("삭제를 취소했어요.");
}

function toggleNoteMenu(noteId: MemoId, params: UseDeleteNoteControllerParams) {
  params.setDeleteIntentId(null);
  params.setNoteMenuId(params.noteMenuId === noteId ? null : noteId);
}

function confirmDeleteNote(deleteTargetNote: Note | null, params: UseDeleteNoteControllerParams) {
  if (!canConfirmDelete(deleteTargetNote, params)) return;
  const targetNote = deleteTargetNote;
  if (!targetNote) return;
  const nextSelection = getNextDeleteSelection(targetNote, params);
  if (!nextSelection) return clearDeleteIntent(params);
  applyDeletedNote(targetNote, nextSelection, params);
  persistDeletedNote(targetNote.id, params.setStatusMessage);
}

function clearDeleteIntent(params: UseDeleteNoteControllerParams) {
  params.setDeleteIntentId(null);
}

function canConfirmDelete(deleteTargetNote: Note | null, params: UseDeleteNoteControllerParams) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 삭제할 수 없어요.");
    return false;
  }

  if (!deleteTargetNote) {
    params.setDeleteIntentId(null);
    return false;
  }

  return true;
}

function getNextDeleteSelection(deleteTargetNote: Note, params: UseDeleteNoteControllerParams) {
  return computeNextSelectionAfterDelete({
    notes: params.notes,
    currentVisibleNotes: getCurrentVisibleNotes(params),
    deleteTargetNoteId: deleteTargetNote.id,
    selectedNoteId: params.selectedNoteId,
    sidebarView: params.sidebarView,
    hasQuery: params.hasQuery,
    query: params.query
  });
}

function getCurrentVisibleNotes(params: UseDeleteNoteControllerParams) {
  if (params.hasQuery) return params.filteredNotes;
  return params.sidebarView === "favorites" ? params.scopedNotes : params.notes;
}

function applyDeletedNote(
  deleteTargetNote: Note,
  nextSelection: { nextNotes: Note[]; nextSelectedNoteId: string },
  params: UseDeleteNoteControllerParams
) {
  params.setNotes(nextSelection.nextNotes);
  params.setSelectedNoteId(nextSelection.nextSelectedNoteId);
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  params.setBackups((currentBackups) => removeDeletedBackup(currentBackups, deleteTargetNote.id));
  params.setStatusMessage("메모를 삭제했어요.");
}

function removeDeletedBackup(currentBackups: Record<MemoId, NoteBackup>, noteId: MemoId) {
  const nextBackups = { ...currentBackups };
  delete nextBackups[noteId];
  return nextBackups;
}

function persistDeletedNote(noteId: MemoId, setStatusMessage: (message: string) => void) {
  if (!isMemoRepositoryAvailable()) {
    return;
  }

  void deleteMemo(noteId).catch(() => {
    setStatusMessage("메모 삭제를 저장소에 반영하지 못했어요.");
  });
}
