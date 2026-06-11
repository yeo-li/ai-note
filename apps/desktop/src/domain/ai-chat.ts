import type { MemoId } from "@ai-note/shared/memo";
import { deriveNoteHeadline } from "../note-content";
import type { ContextSearchResult } from "./search";

export type AiChatIntent = "search" | "summary" | "compose";
export type AiChatStatus = "idle" | "thinking";
type AiChatIntentSignals = {
  wantsCompose: boolean;
  wantsSearch: boolean;
  wantsSummary: boolean;
};
type ComposeRevealCursor = {
  delayMs: number | null;
  nextIndex: number;
  visibleCharCount: number;
};

export type AiChatMessage =
  | {
      id: string;
      role: "user";
      kind: "text";
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      kind: "welcome" | "text" | "error";
      title: string;
      text: string;
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      kind: "search-results";
      title: string;
      query: string;
      results: ContextSearchResult[];
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      kind: "summary";
      title: string;
      query: string;
      summary: string;
      results: ContextSearchResult[];
      createdAt: number;
    }
  | {
      id: string;
      role: "assistant";
      kind: "created-note";
      title: string;
      body: string;
      noteId: MemoId;
      sourceCount: number;
      relatedCount: number;
      createdAt: number;
    };

export const aiChatSuggestions = [
  "계약 일정과 관련된 메모 찾아줘",
  "오늘 할 일을 핵심만 요약해줘"
];

export function createAiChatMessageId() {
  return `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialAiChatMessages(): AiChatMessage[] {
  return [
    {
      id: "ai-chat-welcome",
      role: "assistant",
      kind: "welcome",
      title: "무엇을 도와드릴까요?",
      text: "찾기, 요약, 새 메모 생성까지 한 문장으로 요청해 주세요. 제가 의도를 판단해서 알맞은 형태로 보여드릴게요.",
      createdAt: Date.now()
    }
  ];
}

export function inferAiChatIntent(prompt: string): AiChatIntent {
  const normalizedPrompt = prompt.trim().toLowerCase();

  return resolveAiChatIntent(readAiChatIntentSignals(normalizedPrompt));
}

export function extractMemoSnippet(body: string, fallback: string, headline?: string) {
  const lines = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstUsefulLine = lines.find((line) => line.length > 0 && line !== headline) ?? lines[0] ?? fallback;

  if (firstUsefulLine.length <= 120) {
    return firstUsefulLine;
  }

  return `${firstUsefulLine.slice(0, 120).trim()}...`;
}

export function buildAiChatSummary(query: string, results: ContextSearchResult[]) {
  return createAiChatSummaryLines(query, results, buildAiChatSummaryItems(results)).join("\n");
}

export function getComposeRevealStep(text: string, startIndex: number) {
  if (startIndex >= text.length) {
    return { nextIndex: text.length, delayMs: 0 };
  }

  const currentChar = text[startIndex];

  if (currentChar === "\n") {
    return { nextIndex: startIndex + 1, delayMs: 120 };
  }

  return scanComposeRevealStep(text, startIndex);
}

function readAiChatIntentSignals(normalizedPrompt: string): AiChatIntentSignals {
  return {
    wantsCompose: /(새\s*메모|새로운\s*메모|초안|작성|생성|만들|compose|draft|create)/.test(normalizedPrompt),
    wantsSummary: /(요약|정리|핵심|브리핑|알려|summar|summary|brief)/.test(normalizedPrompt),
    wantsSearch: /(찾|검색|관련|목록|리스트|보여|어떤|어디|find|search|list)/.test(normalizedPrompt)
  };
}

function resolveAiChatIntent(signals: AiChatIntentSignals): AiChatIntent {
  if (signals.wantsCompose) return "compose";
  if (signals.wantsSummary) return "summary";
  if (signals.wantsSearch) return "search";
  return "search";
}

function buildAiChatSummaryItems(results: ContextSearchResult[]) {
  return results.slice(0, 4).map((result, index) => buildAiChatSummaryItem(result, index));
}

function buildAiChatSummaryItem(result: ContextSearchResult, index: number) {
  const title = deriveNoteHeadline(result.memo.body);
  const snippet = extractMemoSnippet(result.memo.body, result.preview || result.reason, title);
  return `${index + 1}. ${title}: ${snippet}`;
}

function createAiChatSummaryLines(query: string, results: ContextSearchResult[], summaryLines: string[]) {
  return [`"${query}"와 관련된 메모 ${results.length}개를 확인했어요.`, "", "핵심 요약", ...summaryLines, "", "필요하면 이 내용을 바탕으로 새 초안 메모를 만들어 달라고 이어서 요청할 수 있어요."];
}

function scanComposeRevealStep(text: string, startIndex: number) {
  let nextIndex = startIndex;
  let visibleCharCount = 0;

  while (nextIndex < text.length && visibleCharCount < 4) {
    const cursor = readNextRevealCursor(text, nextIndex, visibleCharCount);
    nextIndex = cursor.nextIndex;
    visibleCharCount = cursor.visibleCharCount;
    if (cursor.delayMs !== null) return { nextIndex, delayMs: cursor.delayMs };
  }

  return { nextIndex, delayMs: 28 };
}

function readNextRevealCursor(text: string, nextIndex: number, visibleCharCount: number): ComposeRevealCursor {
  const nextChar = text[nextIndex];
  const cursor = { nextIndex: nextIndex + 1, visibleCharCount: visibleCharCount + 1, delayMs: null };
  if (nextChar === "\n") return { ...cursor, delayMs: 120 };
  if (/[.!?]/.test(nextChar)) return { ...cursor, delayMs: 96 };
  return cursor;
}
