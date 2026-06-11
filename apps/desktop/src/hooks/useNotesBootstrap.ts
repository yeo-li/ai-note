import { useEffect, useState } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import type { MemoStoreHealth } from "../shared/memo-bridge";
import { buildMemoTitleFromBody } from "../note-content";
import { toNoteFromMemo } from "../domain/note";
import type { Note } from "../domain/note";
import { getStorageKindLabel, toErrorMessage } from "../domain/storage-status";
import {
  createMemo,
  getMemoStoreHealth,
  isMemoRepositoryAvailable,
  listMemos
} from "../infrastructure/memo-repository";

type UseNotesBootstrapParams = {
  initialNotes: Note[];
  requestedNoteId: MemoId | null;
  setStatusMessage: (message: string) => void;
};

type NotesBootstrapState = ReturnType<typeof useNotesBootstrapState>;
type HydrateNotesContext = UseNotesBootstrapParams & NotesBootstrapState & {
  isCancelled: () => boolean;
};

export function useNotesBootstrap({ initialNotes, requestedNoteId, setStatusMessage }: UseNotesBootstrapParams) {
  const state = useNotesBootstrapState(initialNotes);

  useHydrateNotes({ initialNotes, requestedNoteId, setStatusMessage }, state);

  return createNotesBootstrapResult(state);
}

function useNotesBootstrapState(initialNotes: Note[]) {
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<MemoId | "">(initialNotes[0]?.id ?? "");
  const [storageHealth, setStorageHealth] = useState<MemoStoreHealth | null>(null);
  const [isStorageLocked, setIsStorageLocked] = useState(true);

  return { isStorageLocked, notes, selectedNoteId, setIsStorageLocked, setNotes, setSelectedNoteId, setStorageHealth, storageHealth };
}

function createNotesBootstrapResult(state: NotesBootstrapState) {
  return {
    notes: state.notes,
    setNotes: state.setNotes,
    selectedNoteId: state.selectedNoteId,
    setSelectedNoteId: state.setSelectedNoteId,
    storageHealth: state.storageHealth,
    isStorageLocked: state.isStorageLocked
  };
}

function useHydrateNotes(params: UseNotesBootstrapParams, state: NotesBootstrapState) {
  const { initialNotes, requestedNoteId, setStatusMessage } = params;
  const { setIsStorageLocked, setNotes, setSelectedNoteId, setStorageHealth } = state;

  useEffect(() => {
    let cancelled = false;
    void hydrateNotes({ ...state, initialNotes, requestedNoteId, setStatusMessage, isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [initialNotes, requestedNoteId, setIsStorageLocked, setNotes, setSelectedNoteId, setStatusMessage, setStorageHealth]);
}

async function hydrateNotes(context: HydrateNotesContext) {
  if (!isMemoRepositoryAvailable()) {
    handleUnavailableRepository(context);
    return;
  }

  try {
    await hydrateAvailableRepository(context);
  } catch (error) {
    handleBootstrapError(error, context);
  }
}

async function hydrateAvailableRepository(context: HydrateNotesContext) {
  const health = await getMemoStoreHealth();
  if (context.isCancelled()) return;

  context.setStorageHealth(health);
  if (!health.ready) {
    handleUnreadyRepository(context, health);
    return;
  }

  await hydrateReadyRepository(context, health);
}

function handleUnavailableRepository(context: HydrateNotesContext) {
  if (context.isCancelled()) return;
  context.setStorageHealth(createUnavailableHealth());
  lockNotes(context);
  context.setStatusMessage("메모 저장소 브리지가 연결되지 않아서 편집을 잠가두었어요.");
}

function createUnavailableHealth(): MemoStoreHealth {
  return { bridgeConnected: false, ready: false, storeKind: "memory", errorMessage: "memoAPI 브리지를 찾지 못했어요." };
}

function handleUnreadyRepository(context: HydrateNotesContext, health: MemoStoreHealth) {
  lockNotes(context);
  context.setStatusMessage(`저장소 연결에 실패했어요: ${health.errorMessage ?? "원인을 확인할 수 없어요."}`);
}

async function hydrateReadyRepository(context: HydrateNotesContext, health: MemoStoreHealth) {
  const existingMemos = await listMemos();
  if (context.isCancelled()) return;

  context.setIsStorageLocked(false);
  if (existingMemos.length > 0) {
    loadExistingMemos(context, health, existingMemos.map((memo) => toNoteFromMemo(memo)));
    return;
  }

  await seedInitialMemos(context, health);
}

function loadExistingMemos(context: HydrateNotesContext, health: MemoStoreHealth, loadedNotes: Note[]) {
  const storageLabel = getStorageKindLabel(health.storeKind);
  context.setNotes(loadedNotes);
  context.setSelectedNoteId(resolvePreferredNoteId(context.requestedNoteId, loadedNotes));
  context.setStatusMessage(getExistingMemosStatusMessage(health, storageLabel));
}

async function seedInitialMemos(context: HydrateNotesContext, health: MemoStoreHealth) {
  const seededNotes = await createSeededNotes(context);
  if (!seededNotes) return;

  const storageLabel = getStorageKindLabel(health.storeKind);
  context.setNotes(seededNotes);
  context.setSelectedNoteId(resolvePreferredNoteId(context.requestedNoteId, seededNotes));
  context.setStatusMessage(getSeededMemosStatusMessage(health, storageLabel));
}

async function createSeededNotes(context: HydrateNotesContext) {
  const seededNotes: Note[] = [];
  for (const seedNote of [...context.initialNotes].reverse()) {
    const createdMemo = await createMemo({ title: buildMemoTitleFromBody(seedNote.body), body: seedNote.body });
    if (context.isCancelled()) return null;
    seededNotes.unshift(toNoteFromMemo(createdMemo, seedNote.mode));
  }
  return seededNotes;
}

function resolvePreferredNoteId(requestedNoteId: MemoId | null, notes: Note[]) {
  return requestedNoteId && notes.some((note) => note.id === requestedNoteId) ? requestedNoteId : notes[0]?.id ?? "";
}

function getExistingMemosStatusMessage(health: MemoStoreHealth, storageLabel: string) {
  return health.fallbackReason ? `SQLite 초기화에 실패해서 ${storageLabel} 저장소를 사용하고 있어요.` : `${storageLabel} 저장소를 불러왔어요.`;
}

function getSeededMemosStatusMessage(health: MemoStoreHealth, storageLabel: string) {
  return health.fallbackReason ? `SQLite 초기화에 실패해서 ${storageLabel} 저장소를 초기화했어요.` : `${storageLabel} 저장소를 초기화했어요.`;
}

function handleBootstrapError(error: unknown, context: HydrateNotesContext) {
  if (context.isCancelled()) return;
  const message = toErrorMessage(error);
  context.setStorageHealth(createErrorHealth(message));
  lockNotes(context);
  context.setStatusMessage(`저장소 연결이 중단되어서 편집을 잠가두었어요: ${message}`);
}

function createErrorHealth(message: string): MemoStoreHealth {
  return { bridgeConnected: true, ready: false, storeKind: "memory", errorMessage: message };
}

function lockNotes(context: HydrateNotesContext) {
  context.setIsStorageLocked(true);
  context.setNotes([]);
  context.setSelectedNoteId("");
}
