import type { MemoId } from "@ai-note/shared/memo";

export type ComposePhase = "idle" | "generating" | "animating" | "refused" | "error";

export type ComposeSession = {
  prompt: string;
  phase: ComposePhase;
  submittedPrompt: string;
  resultTitle: string;
  fullBody: string;
  visibleBody: string;
  createdNoteId: MemoId | null;
  relatedCount: number;
  sourceCount: number;
  refusalReason: "no_related_memos" | "insufficient_support" | null;
  errorMessage: string | null;
};

export function createInitialComposeSession(): ComposeSession {
  return {
    prompt: "",
    phase: "idle",
    submittedPrompt: "",
    resultTitle: "",
    fullBody: "",
    visibleBody: "",
    createdNoteId: null,
    relatedCount: 0,
    sourceCount: 0,
    refusalReason: null,
    errorMessage: null
  };
}
