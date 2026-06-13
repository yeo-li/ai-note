import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import { buildMemoTitleFromBody } from "../note-content";
import {
  buildAiChatSummary,
  createAiChatMessageId,
  createInitialAiChatMessages
} from "../domain/ai-chat";
import type { AiChatIntent, AiChatMessage, AiChatStatus } from "../domain/ai-chat";
import { createInitialComposeSession } from "../domain/compose-session";
import type { ComposeSession } from "../domain/compose-session";
import type { ContextSearchState, SidebarSearchMode, SidebarSurface } from "../domain/workspace";
import { toErrorMessage } from "../domain/storage-status";
import { deriveOrganizeIntent } from "../domain/transform";
import { toNoteFromMemo } from "../domain/note";
import type { Note } from "../domain/note";
import {
  composeMemo,
  createMemo,
  isMemoRepositoryAvailable,
  searchMemosByContext
} from "../infrastructure/memo-repository";

type CloseFindBar = (options?: { restoreEditorFocus?: boolean }) => void;

type UseAiChatControllerParams = {
  isStickyMode: boolean;
  isMutationLocked: boolean;
  setStatusMessage: (message: string) => void;
  setContextSearch: Dispatch<SetStateAction<ContextSearchState>>;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setNotes: Dispatch<SetStateAction<Note[]>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSidebarSearchMode: Dispatch<SetStateAction<SidebarSearchMode>>;
  setActiveSidebarSurface: Dispatch<SetStateAction<SidebarSurface>>;
  closeFindBar: CloseFindBar;
};

type AiChatState = ReturnType<typeof useAiChatState>;
type AiChatContext = UseAiChatControllerParams & AiChatState;

export function useAiChatController(params: UseAiChatControllerParams) {
  const state = useAiChatState();
  const context = { ...params, ...state };

  return {
    ...state,
    isAiChatThinking: state.aiChatStatus === "thinking",
    openAiChatPanel: () => openAiChatPanel(context),
    closeAiChatPanel: () => closeAiChatPanel(context),
    toggleAiChatPanel: () => toggleAiChatPanel(context),
    submitAiChatPrompt: (promptOverride?: string) => submitAiChatPrompt(promptOverride, context),
    cancelAiChatRequest: () => cancelAiChatRequest(context),
    openNoteFromAiChat: (noteId: MemoId) => openNoteFromAiChat(noteId, context)
  };
}

function useAiChatState() {
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<AiChatMessage[]>(createInitialAiChatMessages);
  const [aiChatStatus, setAiChatStatus] = useState<AiChatStatus>("idle");
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [aiChatMode, setAiChatMode] = useState<AiChatIntent>("search");
  const aiChatCancelledRef = useRef(false);

  return { isAiChatOpen, setIsAiChatOpen, aiChatInput, setAiChatInput, aiChatMessages, aiChatStatus, setAiChatMessages, setAiChatStatus, isChatExpanded, setIsChatExpanded, aiChatMode, setAiChatMode, aiChatCancelledRef };
}

function appendAiChatMessage(message: AiChatMessage, { setAiChatMessages }: AiChatContext) {
  setAiChatMessages((currentMessages) => [...currentMessages, message]);
}

function openAiChatPanel(context: AiChatContext) {
  if (context.isStickyMode) {
    context.setStatusMessage("AI 채팅은 일반 메모 창에서 사용할 수 있어요.");
    return;
  }

  openAiChatSurface(context);
  resetAiChatCompetingState(context);
  context.setStatusMessage("AI 채팅 패널을 열었어요.");
}

function openAiChatSurface({ setIsAiChatOpen, setIsChatExpanded, setActiveSidebarSurface, setSidebarSearchMode }: AiChatContext) {
  setIsAiChatOpen(true);
  setIsChatExpanded(false);
  setActiveSidebarSurface("notes");
  setSidebarSearchMode("keyword");
}

function resetAiChatCompetingState(context: AiChatContext) {
  context.setContextSearch({ query: "", results: [], hasSearched: false, isLoading: false });
  context.setComposeSession(createInitialComposeSession());
  context.setDeleteIntentId(null);
  context.setNoteMenuId(null);
  context.closeFindBar({ restoreEditorFocus: false });
}

function closeAiChatPanel({ setIsAiChatOpen, setIsChatExpanded, setStatusMessage }: AiChatContext) {
  setIsAiChatOpen(false);
  setIsChatExpanded(false);
  setStatusMessage("AI 채팅 패널을 닫았어요.");
}

function toggleAiChatPanel(context: AiChatContext) {
  if (context.isAiChatOpen) {
    closeAiChatPanel(context);
    return;
  }

  openAiChatPanel(context);
}

async function fetchAiChatSearchResults(prompt: string, context: AiChatContext) {
  if (!isMemoRepositoryAvailable()) {
    throw new Error("AI 검색을 실행할 수 있는 memoAPI 브리지를 찾지 못했어요.");
  }

  const results = await searchMemosByContext(prompt);
  context.setContextSearch({ query: prompt, results, hasSearched: true, isLoading: false });
  return results;
}

async function answerAiChatWithSearch(prompt: string, context: AiChatContext) {
  const results = await fetchAiChatSearchResults(prompt, context);
  if (context.aiChatCancelledRef.current) return;

  if (results.length === 0) {
    appendAiChatMessage(createNoSearchResultsMessage(), context);
    context.setStatusMessage(`"${prompt}"와 관련된 메모를 찾지 못했어요.`);
    return;
  }

  appendAiChatMessage(createSearchResultsMessage(prompt, results), context);
  context.setStatusMessage(`AI 채팅에서 관련 메모 ${results.length}개를 찾았어요.`);
}

function createNoSearchResultsMessage(): AiChatMessage {
  return createTextResponse("관련 메모를 찾지 못했어요", "다른 표현이나 더 구체적인 키워드로 다시 요청해 주세요.");
}

function createSearchResultsMessage(prompt: string, results: Awaited<ReturnType<typeof searchMemosByContext>>): AiChatMessage {
  return { id: createAiChatMessageId(), role: "assistant", kind: "search-results", title: `관련 메모 ${results.length}개`, query: prompt, results, createdAt: Date.now() };
}

async function answerAiChatWithSummary(prompt: string, context: AiChatContext) {
  const results = await fetchAiChatSearchResults(prompt, context);
  if (context.aiChatCancelledRef.current) return;

  if (results.length === 0) {
    appendAiChatMessage(createNoSummaryResultsMessage(), context);
    context.setStatusMessage(`"${prompt}"를 요약할 관련 메모를 찾지 못했어요.`);
    return;
  }

  appendAiChatMessage(createSummaryMessage(prompt, results), context);
  context.setStatusMessage(`AI 채팅에서 관련 메모 ${results.length}개를 요약했어요.`);
}

function createNoSummaryResultsMessage(): AiChatMessage {
  return createTextResponse("요약할 메모를 찾지 못했어요", "요약할 주제를 조금 더 구체적으로 적어 주세요.");
}

function createSummaryMessage(prompt: string, results: Awaited<ReturnType<typeof searchMemosByContext>>): AiChatMessage {
  return { id: createAiChatMessageId(), role: "assistant", kind: "summary", title: "관련 메모 요약", query: prompt, summary: buildAiChatSummary(prompt, results), results, createdAt: Date.now() };
}

function createTextResponse(title: string, text: string): AiChatMessage {
  return { id: createAiChatMessageId(), role: "assistant", kind: "text", title, text, createdAt: Date.now() };
}

async function answerAiChatWithComposedMemo(prompt: string, context: AiChatContext) {
  ensureCanComposeMemo(context);
  const result = await composeMemo({ prompt, intent: deriveOrganizeIntent(prompt) });
  if (context.aiChatCancelledRef.current) return;

  if (result.kind === "refused") {
    appendAiChatMessage(createComposeRefusalMessage(result), context);
    context.setStatusMessage(result.message);
    return;
  }

  await createAiChatComposedNote(result, context);
}

function ensureCanComposeMemo({ isMutationLocked }: AiChatContext) {
  if (isMutationLocked) throw new Error("저장소 연결이 복구될 때까지 새 메모를 만들 수 없어요.");
  if (!isMemoRepositoryAvailable()) throw new Error("메모 조합 API를 찾지 못했어요.");
}

function createComposeRefusalMessage(result: { refusalReason: string; message: string; relatedCount: number }): AiChatMessage {
  const title = result.refusalReason === "no_related_memos" ? "관련 메모를 찾지 못했어요" : "근거가 부족해요";
  return { id: createAiChatMessageId(), role: "assistant", kind: "error", title, text: `${result.message} 관련 메모 ${result.relatedCount}개를 확인했지만 새 메모는 만들지 않았어요.`, createdAt: Date.now() };
}

async function createAiChatComposedNote(result: { title?: string; body: string; sourceCount: number; relatedCount: number }, context: AiChatContext) {
  const resultTitle = result.title || buildMemoTitleFromBody(result.body);
  const createdMemo = await createMemo({ title: resultTitle, body: result.body });
  const nextNote = toNoteFromMemo(createdMemo);

  selectCreatedAiChatNote(nextNote, context);
  appendAiChatMessage(createCreatedNoteMessage(result, resultTitle, nextNote.id), context);
  context.setStatusMessage(`${result.sourceCount}개의 관련 메모를 바탕으로 새 메모를 만들었어요.`);
}

function selectCreatedAiChatNote(nextNote: Note, context: AiChatContext) {
  context.setNotes((currentNotes) => [nextNote, ...currentNotes.filter((note) => note.id !== nextNote.id)]);
  context.setSelectedNoteId(nextNote.id);
  context.setQuery("");
  context.setSidebarSearchMode("keyword");
  context.setActiveSidebarSurface("notes");
}

function createCreatedNoteMessage(result: { body: string; sourceCount: number; relatedCount: number }, title: string, noteId: MemoId): AiChatMessage {
  return { id: createAiChatMessageId(), role: "assistant", kind: "created-note", title, body: result.body, noteId, sourceCount: result.sourceCount, relatedCount: result.relatedCount, createdAt: Date.now() };
}

async function submitAiChatPrompt(promptOverride: string | undefined, context: AiChatContext) {
  if (context.aiChatStatus === "thinking") return;
  const trimmedPrompt = (promptOverride ?? context.aiChatInput).trim();
  if (!prepareAiChatPrompt(trimmedPrompt, context)) return;

  context.aiChatCancelledRef.current = false;

  try {
    await answerAiChatPrompt(trimmedPrompt, context);
  } catch (error) {
    if (!context.aiChatCancelledRef.current) appendAiChatError(error, context);
  } finally {
    if (!context.aiChatCancelledRef.current) context.setAiChatStatus("idle");
  }
}

function cancelAiChatRequest(context: AiChatContext) {
  if (context.aiChatStatus !== "thinking") return;

  context.aiChatCancelledRef.current = true;
  context.setAiChatStatus("idle");
  appendAiChatMessage({ id: createAiChatMessageId(), role: "assistant", kind: "text", title: "요청을 중단했어요", text: "다음 요청을 이어서 입력할 수 있어요.", createdAt: Date.now() }, context);
  context.setStatusMessage("AI 채팅 요청을 중단했어요.");
}

function prepareAiChatPrompt(trimmedPrompt: string, context: AiChatContext) {
  if (!trimmedPrompt) {
    context.setStatusMessage("AI 채팅에 요청할 내용을 입력해 주세요.");
    return false;
  }

  context.setIsAiChatOpen(true);
  context.setAiChatInput("");
  appendAiChatMessage({ id: createAiChatMessageId(), role: "user", kind: "text", text: trimmedPrompt, createdAt: Date.now() }, context);
  context.setAiChatStatus("thinking");
  return true;
}

async function answerAiChatPrompt(trimmedPrompt: string, context: AiChatContext) {
  if (context.aiChatMode === "compose") return answerAiChatWithComposedMemo(trimmedPrompt, context);
  if (context.aiChatMode === "summary") return answerAiChatWithSummary(trimmedPrompt, context);
  return answerAiChatWithSearch(trimmedPrompt, context);
}

function appendAiChatError(error: unknown, context: AiChatContext) {
  appendAiChatMessage({ id: createAiChatMessageId(), role: "assistant", kind: "error", title: "요청을 처리하지 못했어요", text: toErrorMessage(error), createdAt: Date.now() }, context);
  context.setStatusMessage(toErrorMessage(error));
}

function openNoteFromAiChat(noteId: MemoId, context: AiChatContext) {
  context.setSelectedNoteId(noteId);
  context.setDeleteIntentId(null);
  context.setNoteMenuId(null);
  context.setStatusMessage("AI 채팅 결과에서 메모를 열었어요.");
}
