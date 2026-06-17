import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import { normalizeMemoCheckboxSyntax } from "@ai-note/shared/memo";
import { buildMemoTitleFromBody } from "../note-content";
import { getComposeRevealStep } from "../domain/ai-chat";
import { createInitialComposeSession } from "../domain/compose-session";
import type { ComposeSession } from "../domain/compose-session";
import { toNoteFromMemo } from "../domain/note";
import type { Note } from "../domain/note";
import type { ContextSearchState, SidebarSurface } from "../domain/workspace";
import { toErrorMessage } from "../domain/storage-status";
import { deriveOrganizeIntent } from "../domain/transform";
import {
  composeMemo,
  createMemo,
  isMemoRepositoryAvailable
} from "../infrastructure/memo-repository";

type CloseTransformSession = (options: { clearDraft: boolean; clearPrompt: boolean; clearFeedback: boolean }) => void;

type UseComposeControllerParams = {
  closeActiveTransformSession: CloseTransformSession;
  closeFindBar: (options?: { restoreEditorFocus?: boolean }) => void;
  isComposeScreenOpen: boolean;
  setActiveSidebarSurface: Dispatch<SetStateAction<SidebarSurface>>;
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setStatusMessage: (message: string) => void;
};

type ComposeControllerState = ReturnType<typeof useComposeState>;
type ComposeControllerContext = UseComposeControllerParams & ComposeControllerState;
type ComposeMemoResult = Awaited<ReturnType<typeof composeMemo>>;
type RefusedComposeResult = Extract<ComposeMemoResult, { kind: "refused" }>;
type CreatedComposeResult = Exclude<ComposeMemoResult, { kind: "refused" }>;
type ComposeRunContext = {
  animationTimerRef: MutableRefObject<number | null>;
  params: UseComposeControllerParams;
  runSequence: number;
  runSequenceRef: MutableRefObject<number>;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
  trimmedPrompt: string;
};
type ComposeRevealContext = ComposeRunContext & {
  fullBody: string;
  noteId: MemoId;
  sourceCount: number;
};

export function useComposeController(params: UseComposeControllerParams) {
  const state = useComposeState();
  const flags = getComposeFlags(state.composeSession);
  const context = { ...params, ...state };

  useComposePromptFocus(params.isComposeScreenOpen, flags.isComposeAnimating, state.composeSession.prompt, state.composePromptInputRef);
  useEffect(() => () => clearAnimationTimer(state.animationTimerRef), []);

  return { ...state, ...flags, openComposeSession: () => openComposeSession(context), closeComposeSession: () => closeComposeSession(context), startComposeDraft: () => startComposeDraft(context) };
}

function useComposeState() {
  const [composeSession, setComposeSession] = useState<ComposeSession>(createInitialComposeSession);
  const composePromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const animationTimerRef = useRef<number | null>(null);
  const runSequenceRef = useRef(0);

  return { composeSession, setComposeSession, composePromptInputRef, animationTimerRef, runSequenceRef };
}

function getComposeFlags(composeSession: ComposeSession) {
  const isComposeGenerating = composeSession.phase === "generating";
  const isComposeAnimating = composeSession.phase === "animating";
  const isComposeBusy = isComposeGenerating || isComposeAnimating;
  return { isComposeAnimating, isComposeBusy, isComposeGenerating };
}

function openComposeSession(context: ComposeControllerContext) {
  bumpComposeRun(context.runSequenceRef, context.animationTimerRef);
  resetCompetingSurfaces(context);
  context.setComposeSession(createInitialComposeSession());
  context.setActiveSidebarSurface("compose");
  context.setStatusMessage("AI 메모 조합 화면을 열었어요.");
}

function closeComposeSession(context: ComposeControllerContext) {
  bumpComposeRun(context.runSequenceRef, context.animationTimerRef);
  const hasCreatedMemo = Boolean(context.composeSession.createdNoteId);
  context.setComposeSession(createInitialComposeSession());
  context.setActiveSidebarSurface("notes");
  context.setStatusMessage(hasCreatedMemo ? "재구성한 메모를 바로 열었어요." : "AI 메모 조합 화면을 닫았어요.");
}

async function startComposeDraft(context: ComposeControllerContext) {
  const trimmedPrompt = context.composeSession.prompt.trim();
  if (!canStartComposeDraft(trimmedPrompt, context.setStatusMessage)) return;
  await createComposedMemo(trimmedPrompt, context.runSequenceRef, context.animationTimerRef, context.setComposeSession, context);
}

function useComposePromptFocus(
  isComposeScreenOpen: boolean,
  isComposeAnimating: boolean,
  prompt: string,
  composePromptInputRef: RefObject<HTMLTextAreaElement>
) {
  useComposePromptInitialFocus(isComposeScreenOpen, isComposeAnimating, composePromptInputRef);
  useComposePromptHeightSync(isComposeScreenOpen, isComposeAnimating, prompt, composePromptInputRef);
}

function useComposePromptInitialFocus(isComposeScreenOpen: boolean, isComposeAnimating: boolean, composePromptInputRef: RefObject<HTMLTextAreaElement>) {
  useEffect(() => focusComposePromptIfReady(isComposeScreenOpen, isComposeAnimating, composePromptInputRef), [composePromptInputRef, isComposeAnimating, isComposeScreenOpen]);
}

function useComposePromptHeightSync(isComposeScreenOpen: boolean, isComposeAnimating: boolean, prompt: string, composePromptInputRef: RefObject<HTMLTextAreaElement>) {
  useEffect(() => syncComposePromptHeightIfReady(isComposeScreenOpen, isComposeAnimating, composePromptInputRef), [composePromptInputRef, isComposeAnimating, isComposeScreenOpen, prompt]);
}

function focusComposePromptIfReady(isComposeScreenOpen: boolean, isComposeAnimating: boolean, composePromptInputRef: RefObject<HTMLTextAreaElement>) {
  if (!canSyncComposePrompt(isComposeScreenOpen, isComposeAnimating)) return;
  composePromptInputRef.current?.focus();
  composePromptInputRef.current?.select();
  syncComposePromptHeight(composePromptInputRef);
}

function syncComposePromptHeightIfReady(isComposeScreenOpen: boolean, isComposeAnimating: boolean, composePromptInputRef: RefObject<HTMLTextAreaElement>) {
  if (canSyncComposePrompt(isComposeScreenOpen, isComposeAnimating)) {
    syncComposePromptHeight(composePromptInputRef);
  }
}

function canSyncComposePrompt(isComposeScreenOpen: boolean, isComposeAnimating: boolean) {
  return isComposeScreenOpen && !isComposeAnimating;
}

function syncComposePromptHeight(composePromptInputRef: RefObject<HTMLTextAreaElement>) {
  const promptField = composePromptInputRef.current;

  if (!promptField) {
    return;
  }

  promptField.style.height = "0px";
  const nextHeight = Math.min(Math.max(promptField.scrollHeight, 72), 220);
  promptField.style.height = `${nextHeight}px`;
  promptField.style.overflowY = promptField.scrollHeight > 220 ? "auto" : "hidden";
}

function bumpComposeRun(runSequenceRef: MutableRefObject<number>, animationTimerRef: MutableRefObject<number | null>) {
  runSequenceRef.current += 1;
  clearAnimationTimer(animationTimerRef);
}

function clearAnimationTimer(animationTimerRef: MutableRefObject<number | null>) {
  if (animationTimerRef.current === null) {
    return;
  }

  window.clearTimeout(animationTimerRef.current);
  animationTimerRef.current = null;
}

function resetCompetingSurfaces(params: UseComposeControllerParams) {
  params.setDeleteIntentId(null);
  params.setNoteMenuId(null);
  params.closeFindBar();
  params.closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
  params.setContextSearch({ query: "", results: [], hasSearched: false, isLoading: false });
}

function canStartComposeDraft(trimmedPrompt: string, setStatusMessage: (message: string) => void) {
  if (!isMemoRepositoryAvailable()) {
    setStatusMessage("메모 조합 API를 찾지 못했어요.");
    return false;
  }

  if (!trimmedPrompt) {
    setStatusMessage("관련 메모 안에서 다시 정리할 프롬프트를 입력해 주세요.");
    return false;
  }

  return true;
}

async function createComposedMemo(
  trimmedPrompt: string,
  runSequenceRef: MutableRefObject<number>,
  animationTimerRef: MutableRefObject<number | null>,
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>,
  params: UseComposeControllerParams
) {
  const runSequence = startComposeRun(trimmedPrompt, runSequenceRef, animationTimerRef, setComposeSession);
  const context = createComposeRunContext(trimmedPrompt, runSequence, runSequenceRef, animationTimerRef, setComposeSession, params);

  await requestComposedMemo(context);
}

function createComposeRunContext(trimmedPrompt: string, runSequence: number, runSequenceRef: MutableRefObject<number>, animationTimerRef: MutableRefObject<number | null>, setComposeSession: Dispatch<SetStateAction<ComposeSession>>, params: UseComposeControllerParams): ComposeRunContext {
  return { animationTimerRef, params, runSequence, runSequenceRef, setComposeSession, trimmedPrompt };
}

async function requestComposedMemo(context: ComposeRunContext) {
  try {
    const result = await composeMemo({ prompt: context.trimmedPrompt, intent: deriveOrganizeIntent(context.trimmedPrompt) });
    await handleComposeMemoResult(context, result);
  } catch (error) {
    handleComposeMemoError(error, context);
  }
}

async function handleComposeMemoResult(context: ComposeRunContext, result: ComposeMemoResult) {
  if (!isCurrentComposeRun(context)) return;
  if (result.kind === "refused") {
    setRefusedComposeResult(context, result);
    return;
  }

  await persistComposedResult(context, result);
}

function handleComposeMemoError(error: unknown, context: ComposeRunContext) {
  const message = toErrorMessage(error);
  context.params.setStatusMessage(message);
  context.setComposeSession((currentSession) => ({ ...currentSession, phase: "error", errorMessage: message }));
}

function isCurrentComposeRun(context: ComposeRunContext) {
  return context.runSequenceRef.current === context.runSequence;
}

function startComposeRun(
  trimmedPrompt: string,
  runSequenceRef: MutableRefObject<number>,
  animationTimerRef: MutableRefObject<number | null>,
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>
) {
  const runSequence = runSequenceRef.current + 1;
  runSequenceRef.current = runSequence;
  clearAnimationTimer(animationTimerRef);
  setComposeSession((currentSession) => createGeneratingComposeSession(currentSession, trimmedPrompt));
  return runSequence;
}

function createGeneratingComposeSession(currentSession: ComposeSession, trimmedPrompt: string): ComposeSession {
  return {
    ...currentSession,
    ...createEmptyComposeResultFields(),
    phase: "generating",
    submittedPrompt: trimmedPrompt,
    errorMessage: null,
    refusalReason: null
  };
}

function createEmptyComposeResultFields() {
  return { createdNoteId: null, fullBody: "", relatedCount: 0, resultTitle: "", sourceCount: 0, visibleBody: "" };
}

function setRefusedComposeResult(context: ComposeRunContext, result: RefusedComposeResult) {
  context.setComposeSession((currentSession) => createRefusedComposeSession(currentSession, context.trimmedPrompt, result));
  context.params.setStatusMessage(result.message);
}

function createRefusedComposeSession(currentSession: ComposeSession, trimmedPrompt: string, result: RefusedComposeResult): ComposeSession {
  return {
    ...currentSession,
    ...createEmptyComposeResultFields(),
    phase: "refused",
    submittedPrompt: trimmedPrompt,
    relatedCount: result.relatedCount,
    refusalReason: result.refusalReason,
    errorMessage: result.message
  };
}

async function persistComposedResult(context: ComposeRunContext, result: CreatedComposeResult) {
  const resultBody = normalizeMemoCheckboxSyntax(result.body);
  const resultTitle = result.title || buildMemoTitleFromBody(resultBody);
  const createdMemo = await createMemo({ title: resultTitle, body: resultBody });
  if (!isCurrentComposeRun(context)) return;

  const nextNote = toNoteFromMemo(createdMemo);
  saveComposedNote(context, nextNote);
  beginComposeReveal(context, { ...result, body: resultBody }, resultTitle, nextNote.id);
}

function saveComposedNote(context: ComposeRunContext, nextNote: Note) {
  context.params.setNotes((currentNotes) => [nextNote, ...currentNotes.filter((note) => note.id !== nextNote.id)]);
  context.params.setSelectedNoteId(nextNote.id);
}

function beginComposeReveal(context: ComposeRunContext, result: CreatedComposeResult, resultTitle: string, noteId: MemoId) {
  const revealContext = createComposeRevealContext(context, result, noteId);
  context.setComposeSession((currentSession) => createAnimatingComposeSession(currentSession, context.trimmedPrompt, result, resultTitle, noteId));
  context.params.setStatusMessage(`${result.sourceCount}개의 관련 메모를 바탕으로 재구성 메모를 쓰고 있어요.`);
  revealComposeDraft(revealContext);
}

function createComposeRevealContext(context: ComposeRunContext, result: CreatedComposeResult, noteId: MemoId): ComposeRevealContext {
  return { ...context, fullBody: result.body, noteId, sourceCount: result.sourceCount };
}

function createAnimatingComposeSession(currentSession: ComposeSession, trimmedPrompt: string, result: CreatedComposeResult, resultTitle: string, noteId: MemoId): ComposeSession {
  return {
    ...currentSession,
    phase: "animating",
    submittedPrompt: trimmedPrompt,
    resultTitle,
    fullBody: result.body,
    visibleBody: "",
    createdNoteId: noteId,
    relatedCount: result.relatedCount,
    sourceCount: result.sourceCount,
    refusalReason: null,
    errorMessage: null
  };
}

function revealComposeDraft(context: ComposeRevealContext, nextIndex = 0) {
  if (!isCurrentComposeRun(context)) return;
  if (finishComposeReveal(context, nextIndex)) return;

  scheduleNextComposeReveal(context, nextIndex);
}

function finishComposeReveal(context: ComposeRevealContext, nextIndex: number) {
  if (nextIndex < context.fullBody.length) {
    return false;
  }

  context.animationTimerRef.current = null;
  context.setComposeSession(createInitialComposeSession());
  context.params.setActiveSidebarSurface("notes");
  context.params.setStatusMessage(`${context.sourceCount}개의 관련 메모를 바탕으로 재구성한 메모를 열었어요.`);
  context.params.setSelectedNoteId(context.noteId);
  return true;
}

function scheduleNextComposeReveal(context: ComposeRevealContext, nextIndex: number) {
  const { nextIndex: revealedIndex, delayMs } = getComposeRevealStep(context.fullBody, nextIndex);
  context.setComposeSession((currentSession) => updateVisibleComposeBody(currentSession, context.noteId, context.fullBody, revealedIndex));
  context.animationTimerRef.current = window.setTimeout(() => revealComposeDraft(context, revealedIndex), delayMs);
}

function updateVisibleComposeBody(currentSession: ComposeSession, noteId: MemoId, fullBody: string, revealedIndex: number) {
  if (currentSession.createdNoteId !== noteId) {
    return currentSession;
  }

  return {
    ...currentSession,
    visibleBody: fullBody.slice(0, revealedIndex)
  };
}
