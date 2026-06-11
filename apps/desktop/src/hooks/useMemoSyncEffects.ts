import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoChangeEvent, MemoId } from "@ai-note/shared/memo";
import type { Note, NoteBackup } from "../domain/note";
import {
  removeSyncedNote,
  resolveSelectedNoteId,
  upsertSyncedNote
} from "../domain/note";
import type { TransformSession } from "../domain/transform";
import type { SidebarView } from "../domain/workspace";
import { subscribeToMemoChanges } from "../infrastructure/memo-repository";

type UseMemoSyncEffectsParams = {
  notes: Note[];
  scopedNotes: Note[];
  selectedNote: Note | null;
  selectedNoteId: MemoId | "";
  sidebarView: SidebarView;
  setBackups: Dispatch<SetStateAction<Record<MemoId, NoteBackup>>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setOrganizingNotes: Dispatch<SetStateAction<Record<MemoId, number>>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setTransformSession: Dispatch<SetStateAction<TransformSession | null>>;
};

export function useMemoSyncEffects(params: UseMemoSyncEffectsParams) {
  useMemoChangeSubscription(params);
  useSelectedNoteResolution(params);
}

function useMemoChangeSubscription(params: UseMemoSyncEffectsParams) {
  useEffect(() => {
    const unsubscribe = subscribeToMemoChanges((changeEvent) => applyMemoChange(changeEvent, params));
    return () => unsubscribe();
  }, []);
}

function applyMemoChange(changeEvent: MemoChangeEvent, params: UseMemoSyncEffectsParams) {
  if (changeEvent.type === "deleted") {
    removeDeletedMemoState(changeEvent.memoId, params);
    return;
  }

  params.setNotes((currentNotes) => upsertSyncedNote(currentNotes, changeEvent.memo));
}

function removeDeletedMemoState(memoId: MemoId, params: UseMemoSyncEffectsParams) {
  params.setNotes((currentNotes) => removeSyncedNote(currentNotes, memoId));
  params.setDeleteIntentId((currentId) => (currentId === memoId ? null : currentId));
  params.setNoteMenuId((currentId) => (currentId === memoId ? null : currentId));
  params.setTransformSession((currentSession) => (currentSession?.noteId === memoId ? null : currentSession));
  params.setOrganizingNotes((currentNotes) => removeRecordEntry(currentNotes, memoId));
  params.setBackups((currentBackups) => removeRecordEntry(currentBackups, memoId));
}

function removeRecordEntry<T>(record: Record<MemoId, T>, memoId: MemoId) {
  if (!record[memoId]) {
    return record;
  }

  const nextRecord = { ...record };
  delete nextRecord[memoId];
  return nextRecord;
}

function useSelectedNoteResolution(params: UseMemoSyncEffectsParams) {
  useEffect(() => {
    const nextSelectedNoteId = resolveSelectedNoteId(params);

    if (nextSelectedNoteId !== params.selectedNoteId) {
      params.setSelectedNoteId(nextSelectedNoteId);
    }
  }, [params.notes, params.scopedNotes, params.selectedNote, params.selectedNoteId, params.sidebarView]);
}
