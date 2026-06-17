import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import { normalizeMemoCheckboxSyntax, serializeMemoCheckboxesForMarkdown } from "@ai-note/shared/memo";
import { buildMemoTitleFromBody } from "../note-content";
import { buildPreviewDiffSegments } from "../domain/diff";
import type { Note, NoteBackup } from "../domain/note";
import {
  deriveOrganizeIntent,
  formatElapsedSeconds,
  getProgressFeedback
} from "../domain/transform";
import type { TransformSession } from "../domain/transform";
import type { SidebarSurface } from "../domain/workspace";
import { toErrorMessage } from "../domain/storage-status";
import {
  getOrganizingMemoIds,
  isMemoRepositoryAvailable,
  organizeMemo,
  subscribeToOrganizeState
} from "../infrastructure/memo-repository";

type PatchActiveNote = (update: Partial<Note>, message?: string) => void;

type UseTransformControllerParams = {
  activeNote: Note | null;
  isMutationLocked: boolean;
  isStickyMode: boolean;
  patchActiveNote: PatchActiveNote;
  setActiveSidebarSurface: Dispatch<SetStateAction<SidebarSurface>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setStatusMessage: (message: string) => void;
};

type TransformControllerState = ReturnType<typeof useTransformControllerState>;
type TransformControllerDerived = ReturnType<typeof useTransformControllerDerived>;
type UpdateTransformSession = (updater: (session: TransformSession) => TransformSession | null) => void;
type TransformPreviewResult = Awaited<ReturnType<typeof organizeMemo>>;
type TransformPreviewContext = {
  params: UseTransformControllerParams;
  setOrganizingNotes: Dispatch<SetStateAction<Record<MemoId, number>>>;
  startedAt: number;
  trimmedPrompt: string;
  updateActiveTransformSession: UpdateTransformSession;
};
type RestoreBackupContext = {
  backups: Record<MemoId, NoteBackup>;
  closeActiveTransformSession: (options: ReturnType<typeof createCloseTransformOptions>) => void;
  params: UseTransformControllerParams;
  setBackups: Dispatch<SetStateAction<Record<MemoId, NoteBackup>>>;
};

export function useTransformController(params: UseTransformControllerParams) {
  const state = useTransformControllerState();
  const derived = useTransformControllerDerived(params, state);

  useTransformControllerEffects(state, derived.isAnyTransformGenerating);

  return createTransformControllerResult(params, state, derived);
}

function useTransformControllerState() {
  return { ...useTransformSessionState(), ...useTransformOrganizingState() };
}

function useTransformSessionState() {
  const [backups, setBackups] = useState<Record<MemoId, NoteBackup>>({});
  const [transformSession, setTransformSession] = useState<TransformSession | null>(null);
  const [isPreviewActionCoolingDown, setIsPreviewActionCoolingDown] = useState(false);
  const previewActionCooldownRef = useRef<number | null>(null);

  return { backups, isPreviewActionCoolingDown, previewActionCooldownRef, setBackups, setIsPreviewActionCoolingDown, setTransformSession, transformSession };
}

function useTransformOrganizingState() {
  const [organizingNotes, setOrganizingNotes] = useState<Record<MemoId, number>>({});
  const [progressNow, setProgressNow] = useState(() => Date.now());

  return { organizingNotes, progressNow, setOrganizingNotes, setProgressNow };
}

function useTransformControllerDerived(params: UseTransformControllerParams, state: TransformControllerState) {
  const activeTransformSession = getActiveTransformSession(state.transformSession, params.activeNote);
  const activeDraft = activeTransformSession?.draft ?? null;
  const activeAiPrompt = activeTransformSession?.prompt ?? "";
  const activeOrganizingStartedAt = getActiveOrganizingStartedAt(params.activeNote, state.organizingNotes);
  const isTransformPreviewGenerating = Boolean(activeOrganizingStartedAt);
  const isAnyTransformGenerating = Object.keys(state.organizingNotes).length > 0;
  const activeTransformFeedback = useTransformFeedback(activeOrganizingStartedAt, activeTransformSession, state.progressNow);
  const previewDiffSegments = useMemo(() => buildDiffSegments(params.activeNote, activeDraft), [activeDraft, params.activeNote]);
  const hasBackup = params.activeNote ? Boolean(state.backups[params.activeNote.id]) : false;

  return { activeAiPrompt, activeDraft, activeOrganizingStartedAt, activeTransformFeedback, activeTransformSession, hasBackup, isAnyTransformGenerating, isTransformPreviewGenerating, previewDiffSegments };
}

function useTransformControllerEffects(state: TransformControllerState, isAnyTransformGenerating: boolean) {
  useOrganizingState(state.setOrganizingNotes);
  useTransformProgressClock(isAnyTransformGenerating, state.setProgressNow);
  useEffect(() => () => clearPreviewCooldown(state.previewActionCooldownRef), [state.previewActionCooldownRef]);
}

function createTransformControllerResult(params: UseTransformControllerParams, state: TransformControllerState, derived: TransformControllerDerived) {
  return {
    ...selectTransformDerivedExports(derived),
    ...selectTransformStateExports(state),
    ...createTransformActions(params, state, derived)
  };
}

function selectTransformDerivedExports(derived: TransformControllerDerived) {
  return {
    ...derived,
    isAiPromptOpen: derived.activeTransformSession?.isOpen ?? false,
    isActiveNoteBusy: Boolean(derived.activeOrganizingStartedAt)
  };
}

function selectTransformStateExports(state: TransformControllerState) {
  return {
    backups: state.backups,
    isPreviewActionCoolingDown: state.isPreviewActionCoolingDown,
    organizingNotes: state.organizingNotes,
    setBackups: state.setBackups,
    setOrganizingNotes: state.setOrganizingNotes,
    setTransformSession: state.setTransformSession,
    transformSession: state.transformSession
  };
}

function createTransformActions(params: UseTransformControllerParams, state: TransformControllerState, derived: TransformControllerDerived) {
  return {
    openTransformSession: (noteId: MemoId, nextPrompt?: string) => openTransformSession(noteId, nextPrompt, state),
    closeActiveTransformSession: (options = createCloseTransformOptions()) => closeActiveTransformSession(params, state, options),
    updateActiveTransformSession: (updater: (session: TransformSession) => TransformSession | null) => updateActiveTransformSession(params, state, updater),
    startTransformPreview: () => startTransformPreview(params, state, derived),
    cancelTransformPreview: () => cancelTransformPreview(params, state),
    applyTransformDraft: () => applyTransformDraft(params, state, derived),
    restoreOriginal: () => restoreOriginal(params, state)
  };
}

function openTransformSession(noteId: MemoId, nextPrompt: string | undefined, state: TransformControllerState) {
  state.setTransformSession((currentSession) => openTransformSessionState(currentSession, noteId, nextPrompt));
}

function closeActiveTransformSession(params: UseTransformControllerParams, state: TransformControllerState, options: ReturnType<typeof createCloseTransformOptions>) {
  state.setTransformSession((currentSession) => closeTransformSessionState(currentSession, params.activeNote, options));
}

function updateActiveTransformSession(params: UseTransformControllerParams, state: TransformControllerState, updater: (session: TransformSession) => TransformSession | null) {
  state.setTransformSession((currentSession) => updateTransformSessionState(currentSession, params.activeNote, updater));
}

async function startTransformPreview(params: UseTransformControllerParams, state: TransformControllerState, derived: TransformControllerDerived) {
  if (!canStartTransformPreview(params, derived.activeAiPrompt, derived.isAnyTransformGenerating)) return;
  const updateSession = (updater: (session: TransformSession) => TransformSession | null) => updateActiveTransformSession(params, state, updater);
  const context = createTransformPreviewContext(params, state, updateSession, derived.activeAiPrompt.trim());

  await runTransformPreview(context);
}

function cancelTransformPreview(params: UseTransformControllerParams, state: TransformControllerState) {
  params.setNoteMenuId(null);
  updateActiveTransformSession(params, state, (session) => ({ ...session, draft: null, feedback: null }));
  startPreviewCooldown(state.setIsPreviewActionCoolingDown, state.previewActionCooldownRef);
  params.setStatusMessage("미리보기를 닫았어요.");
}

function applyTransformDraft(params: UseTransformControllerParams, state: TransformControllerState, derived: TransformControllerDerived) {
  if (!canApplyTransformDraft(params, derived.activeDraft) || !derived.activeDraft) return;
  rememberOriginalIfNeeded(params.activeNote, state.setBackups);
  params.patchActiveNote({ body: derived.activeDraft.previewBody, mode: "organized" }, getApplyDraftMessage(derived.activeDraft.prompt));
}

function restoreOriginal(params: UseTransformControllerParams, state: TransformControllerState) {
  if (!canRestoreOriginal(params, state.backups)) return;
  const closeSession = (options: ReturnType<typeof createCloseTransformOptions>) => closeActiveTransformSession(params, state, options);

  restoreBackup({ backups: state.backups, closeActiveTransformSession: closeSession, params, setBackups: state.setBackups });
}

function getActiveTransformSession(transformSession: TransformSession | null, activeNote: Note | null) {
  return transformSession && activeNote && transformSession.noteId === activeNote.id ? transformSession : null;
}

function getActiveOrganizingStartedAt(activeNote: Note | null, organizingNotes: Record<MemoId, number>) {
  return activeNote ? organizingNotes[activeNote.id] ?? null : null;
}

function useTransformFeedback(activeOrganizingStartedAt: number | null, activeTransformSession: TransformSession | null, progressNow: number) {
  return useMemo(() => {
    if (!activeOrganizingStartedAt) {
      return activeTransformSession?.feedback ?? null;
    }

    return {
      kind: "progress" as const,
      ...getProgressFeedback(Math.max(progressNow - activeOrganizingStartedAt, 0))
    };
  }, [activeOrganizingStartedAt, activeTransformSession?.feedback, progressNow]);
}

function buildDiffSegments(activeNote: Note | null, activeDraft: TransformSession["draft"]) {
  return activeDraft && activeNote ? buildPreviewDiffSegments(activeNote.body, activeDraft.previewBody) : [];
}

function useOrganizingState(setOrganizingNotes: Dispatch<SetStateAction<Record<MemoId, number>>>) {
  useEffect(() => {
    let cancelled = false;
    void hydrateOrganizingNotes(setOrganizingNotes, () => cancelled);
    const unsubscribe = subscribeToOrganizeState(({ memoId, busy }) => updateOrganizingNote(setOrganizingNotes, memoId, busy));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [setOrganizingNotes]);
}

async function hydrateOrganizingNotes(
  setOrganizingNotes: Dispatch<SetStateAction<Record<MemoId, number>>>,
  isCancelled: () => boolean
) {
  const memoIds = await getOrganizingMemoIds();

  if (isCancelled()) {
    return;
  }

  const startedAt = Date.now();
  setOrganizingNotes(Object.fromEntries(memoIds.map((memoId) => [memoId, startedAt])) as Record<MemoId, number>);
}

function updateOrganizingNote(setOrganizingNotes: Dispatch<SetStateAction<Record<MemoId, number>>>, memoId: MemoId, busy: boolean) {
  setOrganizingNotes((currentNotes) => (busy ? addOrganizingNote(currentNotes, memoId) : removeOrganizingNote(currentNotes, memoId)));
}

function addOrganizingNote(currentNotes: Record<MemoId, number>, memoId: MemoId) {
  return currentNotes[memoId] ? currentNotes : { ...currentNotes, [memoId]: Date.now() };
}

function removeOrganizingNote(currentNotes: Record<MemoId, number>, memoId: MemoId) {
  if (!currentNotes[memoId]) {
    return currentNotes;
  }

  const nextNotes = { ...currentNotes };
  delete nextNotes[memoId];
  return nextNotes;
}

function useTransformProgressClock(isAnyTransformGenerating: boolean, setProgressNow: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    if (!isAnyTransformGenerating) {
      return;
    }

    setProgressNow(Date.now());
    const timer = window.setInterval(() => setProgressNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isAnyTransformGenerating, setProgressNow]);
}

function clearPreviewCooldown(previewActionCooldownRef: MutableRefObject<number | null>) {
  if (previewActionCooldownRef.current !== null) {
    window.clearTimeout(previewActionCooldownRef.current);
  }
}

function openTransformSessionState(currentSession: TransformSession | null, noteId: MemoId, nextPrompt?: string): TransformSession {
  if (currentSession?.noteId === noteId) {
    return {
      ...currentSession,
      isOpen: true,
      prompt: typeof nextPrompt === "string" ? nextPrompt : currentSession.prompt
    };
  }

  return { noteId, isOpen: true, prompt: nextPrompt ?? "", draft: null, feedback: null, startedAt: null };
}

function createCloseTransformOptions() {
  return { clearDraft: false, clearPrompt: false, clearFeedback: true };
}

function closeTransformSessionState(
  currentSession: TransformSession | null,
  activeNote: Note | null,
  options: ReturnType<typeof createCloseTransformOptions>
) {
  if (!activeNote || !currentSession || currentSession.noteId !== activeNote.id) {
    return currentSession;
  }

  const nextSession = closeTransformSessionFields(currentSession, options);
  return shouldDropTransformSession(nextSession) ? null : nextSession;
}

function closeTransformSessionFields(session: TransformSession, options: ReturnType<typeof createCloseTransformOptions>) {
  return {
    ...session,
    isOpen: false,
    draft: options.clearDraft ? null : session.draft,
    prompt: options.clearPrompt ? "" : session.prompt,
    feedback: options.clearFeedback ? null : session.feedback
  };
}

function shouldDropTransformSession(session: TransformSession) {
  return !session.isOpen && !session.draft && !session.prompt && !session.feedback;
}

function updateTransformSessionState(
  currentSession: TransformSession | null,
  activeNote: Note | null,
  updater: (session: TransformSession) => TransformSession | null
) {
  if (!activeNote || !currentSession || currentSession.noteId !== activeNote.id) {
    return currentSession;
  }

  return updater(currentSession);
}

function canStartTransformPreview(params: UseTransformControllerParams, activeAiPrompt: string, isAnyTransformGenerating: boolean) {
  if (isAnyTransformGenerating) return false;
  if (!ensureTransformReady(params)) return false;
  if (!params.activeNote?.body.trim()) {
    params.setStatusMessage("본문이 비어 있어서 정리할 내용이 없어요.");
    return false;
  }
  return Boolean(activeAiPrompt || activeAiPrompt === "");
}

function ensureTransformReady({ activeNote, isMutationLocked, isStickyMode, setStatusMessage }: UseTransformControllerParams) {
  if (isMutationLocked) {
    setStatusMessage("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없어요.");
    return false;
  }

  if (isStickyMode) {
    setStatusMessage("스티커 메모에서는 AI 정리 미리보기를 열 수 없어요. 일반 모드에서 실행해 주세요.");
    return false;
  }

  return Boolean(activeNote);
}

function createTransformPreviewContext(params: UseTransformControllerParams, state: TransformControllerState, updateActiveTransformSession: UpdateTransformSession, trimmedPrompt: string): TransformPreviewContext {
  return { params, setOrganizingNotes: state.setOrganizingNotes, startedAt: Date.now(), trimmedPrompt, updateActiveTransformSession };
}

async function runTransformPreview(context: TransformPreviewContext) {
  beginTransformPreview(context);
  if (!isMemoRepositoryAvailable()) {
    handleMissingTransformRepository(context);
    return;
  }

  await completeTransformPreviewRequest(context);
}

function handleMissingTransformRepository(context: TransformPreviewContext) {
  context.params.setStatusMessage("AI 정리 브리지를 찾지 못했어요.");
  finishTransformPreview(context);
}

async function completeTransformPreviewRequest(context: TransformPreviewContext) {
  try {
    await requestTransformPreview(context);
  } catch (error) {
    handleTransformPreviewError(error, context);
  } finally {
    finishTransformPreview(context);
  }
}

function beginTransformPreview(context: TransformPreviewContext) {
  const activeNote = context.params.activeNote;
  if (!activeNote) return;

  context.params.setDeleteIntentId(null);
  context.params.setNoteMenuId(null);
  context.updateActiveTransformSession((session) => createStartedTransformSession(session, context));
  context.setOrganizingNotes((currentNotes) => ({ ...currentNotes, [activeNote.id]: context.startedAt }));
  context.params.setStatusMessage(getTransformPreviewStartMessage(context.trimmedPrompt));
}

function createStartedTransformSession(session: TransformSession, context: TransformPreviewContext) {
  return { ...session, isOpen: true, prompt: context.trimmedPrompt, draft: null, feedback: null, startedAt: context.startedAt };
}

function getTransformPreviewStartMessage(trimmedPrompt: string) {
  return trimmedPrompt ? "AI 정리 미리보기를 만들고 있어요." : "기본 AI 정리 미리보기를 만들고 있어요.";
}

async function requestTransformPreview(context: TransformPreviewContext) {
  const activeNote = context.params.activeNote;
  if (!activeNote) return;

  const result = await organizeMemo(createTransformPreviewRequest(activeNote, context.trimmedPrompt));
  context.updateActiveTransformSession((session) => applyTransformPreviewResult(session, activeNote.id, context.trimmedPrompt, result, context.startedAt));
  context.params.setStatusMessage(hasOrganizeSuggestion(result) ? result.summary : "AI 정리 결과를 받지 못했어요.");
}

function createTransformPreviewRequest(activeNote: Note, trimmedPrompt: string) {
  const aiBody = serializeMemoCheckboxesForMarkdown(activeNote.body);

  return {
    memoId: activeNote.id,
    title: buildMemoTitleFromBody(aiBody),
    body: aiBody,
    intent: deriveOrganizeIntent(trimmedPrompt),
    prompt: trimmedPrompt
  };
}

function applyTransformPreviewResult(session: TransformSession, noteId: MemoId, trimmedPrompt: string, result: TransformPreviewResult, startedAt: number) {
  const elapsedLabel = formatElapsedSeconds(Date.now() - startedAt);

  if (!hasOrganizeSuggestion(result)) {
    return {
      ...session,
      isOpen: true,
      startedAt,
      draft: null,
      feedback: createTransformEmptyResultFeedback(elapsedLabel)
    };
  }

  return {
    ...session,
    isOpen: true,
    startedAt,
    draft: createTransformDraft(noteId, trimmedPrompt, result),
    feedback: createTransformFeedback(result, elapsedLabel)
  };
}

function hasOrganizeSuggestion(result: TransformPreviewResult): result is TransformPreviewResult & { suggested: string } {
  return typeof (result as { suggested?: unknown })?.suggested === "string";
}

function createTransformEmptyResultFeedback(elapsedLabel: string) {
  return {
    kind: "warning" as const,
    title: "AI 정리 결과 없음",
    message: `${elapsedLabel} 만에 응답을 받았지만 정리 결과가 없었어요.`
  };
}

function createTransformDraft(
  noteId: MemoId,
  trimmedPrompt: string,
  result: { suggested: string; provider?: "api" | "local"; fallbackErrorMessage?: string | null }
) {
  return {
    noteId,
    prompt: trimmedPrompt,
    previewBody: normalizeMemoCheckboxSyntax(result.suggested),
    provider: result.provider ?? null,
    fallbackErrorMessage: result.fallbackErrorMessage ?? null
  };
}

function createTransformFeedback(result: { fallbackErrorMessage?: string | null; summary: string }, elapsedLabel: string) {
  if (result.fallbackErrorMessage) {
    return {
      kind: "warning" as const,
      title: "로컬 정리로 대체됨",
      message: `${elapsedLabel} 만에 초안을 만들었어요. ${result.fallbackErrorMessage}`
    };
  }

  return {
    kind: "success" as const,
    title: "AI 정리 완료",
    message: `${elapsedLabel} 만에 생성되었어요. ${result.summary}`
  };
}

function handleTransformPreviewError(error: unknown, context: TransformPreviewContext) {
  const message = toErrorMessage(error);
  context.updateActiveTransformSession((session) => ({ ...session, isOpen: true, draft: null, feedback: createTransformErrorFeedback(message) }));
  context.params.setStatusMessage(message);
}

function createTransformErrorFeedback(message: string) {
  return {
    kind: "error" as const,
    title: "AI 정리 실패",
    message: `LLM 결과를 가져오지 못했어요. ${message}`
  };
}

function finishTransformPreview(context: TransformPreviewContext) {
  const activeNote = context.params.activeNote;
  if (activeNote) {
    context.setOrganizingNotes((currentNotes) => removeOrganizingNote(currentNotes, activeNote.id));
  }

  context.updateActiveTransformSession((session) => clearFinishedTransformStart(session, context.startedAt));
}

function clearFinishedTransformStart(session: TransformSession, startedAt: number) {
  return { ...session, startedAt: session.startedAt === startedAt ? null : session.startedAt };
}

function startPreviewCooldown(
  setIsPreviewActionCoolingDown: Dispatch<SetStateAction<boolean>>,
  previewActionCooldownRef: MutableRefObject<number | null>
) {
  setIsPreviewActionCoolingDown(true);
  clearPreviewCooldown(previewActionCooldownRef);
  previewActionCooldownRef.current = window.setTimeout(() => {
    setIsPreviewActionCoolingDown(false);
    previewActionCooldownRef.current = null;
  }, 220);
}

function canApplyTransformDraft(params: UseTransformControllerParams, activeDraft: TransformSession["draft"]) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 미리보기를 적용할 수 없어요.");
    return false;
  }

  return Boolean(params.activeNote && activeDraft);
}

function rememberOriginalIfNeeded(activeNote: Note | null, setBackups: Dispatch<SetStateAction<Record<MemoId, NoteBackup>>>) {
  if (!activeNote) {
    return;
  }

  setBackups((currentBackups) => currentBackups[activeNote.id] ? currentBackups : { ...currentBackups, [activeNote.id]: { body: activeNote.body, mode: activeNote.mode } });
}

function getApplyDraftMessage(prompt: string) {
  return prompt ? "AI 정리 결과를 현재 메모에 반영했어요." : "기본 AI 정리 결과를 반영했어요.";
}

function canRestoreOriginal(params: UseTransformControllerParams, backups: Record<MemoId, NoteBackup>) {
  if (params.isMutationLocked) {
    params.setStatusMessage("저장소 연결이 복구될 때까지 원문 복원을 실행할 수 없어요.");
    return false;
  }

  if (!params.activeNote || !backups[params.activeNote.id]) {
    params.setStatusMessage("복원할 원문이 없어요.");
    return false;
  }

  return true;
}

function restoreBackup(context: RestoreBackupContext) {
  const activeNote = context.params.activeNote;

  if (!activeNote) {
    return;
  }

  const original = context.backups[activeNote.id];
  context.params.patchActiveNote({ body: original.body, mode: original.mode }, "원문 상태로 다시 복원했어요.");
  context.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  context.params.setNoteMenuId(null);
  context.setBackups((currentBackups) => removeBackup(currentBackups, activeNote.id));
}

function removeBackup(currentBackups: Record<MemoId, NoteBackup>, noteId: MemoId) {
  const nextBackups = { ...currentBackups };
  delete nextBackups[noteId];
  return nextBackups;
}
