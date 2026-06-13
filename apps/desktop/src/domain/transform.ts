import type { MemoId, MemoOrganizeIntent } from "@ai-note/shared/memo";

export type TransformDraft = {
  noteId: MemoId;
  prompt: string;
  previewBody: string;
  provider: "api" | "local" | null;
  fallbackErrorMessage: string | null;
};

export type TransformFeedback = {
  kind: "success" | "warning" | "error";
  title: string;
  message: string;
};

export type TransformSession = {
  noteId: MemoId;
  isOpen: boolean;
  prompt: string;
  draft: TransformDraft | null;
  feedback: TransformFeedback | null;
  startedAt: number | null;
};

export function deriveOrganizeIntent(prompt: string): MemoOrganizeIntent {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (/(공손|존댓말|격식|정중|polite)/.test(normalizedPrompt)) {
    return "polite";
  }

  return "polish";
}

export function formatElapsedSeconds(elapsedMs: number) {
  const elapsedSeconds = elapsedMs / 1000;

  if (elapsedSeconds < 10) {
    return `${elapsedSeconds.toFixed(1)}초`;
  }

  return `${Math.round(elapsedSeconds)}초`;
}

export function getProgressFeedback(elapsedMs: number) {
  if (elapsedMs < 2500) {
    return createProgressFeedback("AI 정리 준비 중", "메모 흐름을 읽고 초안 방향을 잡고 있어요.");
  }

  if (elapsedMs < 6000) {
    return createProgressFeedback("AI 정리 진행 중", "문장을 다듬고 요청한 톤으로 바꾸는 중이에요.");
  }

  return createProgressFeedback("거의 다 완료되었어요", "마지막 문장과 형식을 정리하고 있어요.");
}

function createProgressFeedback(title: string, message: string) {
  return { title, message };
}
