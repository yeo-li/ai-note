export type MemoId = string;

export type MemoCategory = string;

export type MemoCategoryDefinition = {
  id: MemoCategory;
  label: string;
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
};

export const MEMO_CATEGORIES: readonly MemoCategory[];

export const MEMO_CATEGORY_LABELS: Record<string, string>;

export function normalizeMemoCategoryValue(value: unknown): MemoCategory | null;

export function getMemoCategoryLabel(category: MemoCategory | null | undefined): string;

export type Memo = {
  id: MemoId;
  title: string;
  body: string;
  favorite: boolean;
  category: MemoCategory | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoChangeEvent =
  | {
      type: "created";
      memo: Memo;
    }
  | {
      type: "updated";
      memo: Memo;
    }
  | {
      type: "deleted";
      memoId: MemoId;
    };

export type MemoCreateInput = {
  title?: string;
  body?: string;
  category?: MemoCategory | null;
};

export type MemoCategoryCreateInput = {
  label: string;
};

export type MemoUpdateInput = {
  title?: string;
  body?: string;
  favorite?: boolean;
  category?: MemoCategory | null;
};

export type MemoSearchResult = {
  memo: Memo;
  score: number;
  preview: string;
  matchedTerms: string[];
};

export type MemoOrganizeIntent = "polish" | "polite";

export type MemoOrganizeInput = {
  memoId: MemoId;
  title?: string;
  body: string;
  intent: MemoOrganizeIntent;
  prompt?: string;
};

export type MemoOrganizeResult = {
  intent: MemoOrganizeIntent;
  original: string;
  suggested: string;
  summary: string;
  provider?: "api" | "local";
  fallbackErrorMessage?: string | null;
};
