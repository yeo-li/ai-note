import type { Memo } from "@ai-note/shared/memo";

export type ContextSearchResult = {
  memo: Memo;
  preview: string;
  reason: string;
};
