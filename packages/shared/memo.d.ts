export type MemoId = string;

export type MemoCategory = string;

export type MemoCategoryDefinition = {
  id: MemoCategory;
  label: string;
  description: string;
  builtin: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MEMO_CATEGORIES: readonly MemoCategory[];

export const MEMO_CATEGORY_LABELS: Record<string, string>;

export type MemoStickyColor = "yellow" | "pink" | "blue" | "green" | "purple";

export const MEMO_STICKY_COLORS: readonly MemoStickyColor[];

export const MEMO_CHECKBOX_UNCHECKED: "- [ ]";

export const MEMO_CHECKBOX_CHECKED: "- [x]";

export function normalizeMemoCategoryValue(value: unknown): MemoCategory | null;

export function normalizeMemoCategoryDescription(value: unknown): string;

export function getMemoCategoryLabel(category: MemoCategory | null | undefined): string;

export function normalizeMemoStickyColor(value: unknown): MemoStickyColor | null;

export type MemoCheckboxLine = {
  indentation: string;
  checked: boolean;
  text: string;
  source: "app" | "markdown";
};

export type MemoCheckboxInsertion = {
  body: string;
  selectionStart: number;
  selectionEnd: number;
};

export function parseMemoCheckboxLine(line: unknown): MemoCheckboxLine | null;

export function formatMemoCheckboxLine(line?: Partial<Omit<MemoCheckboxLine, "source">>): string;

export function normalizeMemoCheckboxSyntax(body: unknown): string;

export function serializeMemoCheckboxesForMarkdown(body: unknown): string;

export function hasMemoCheckboxSyntax(body: unknown): boolean;

export function toggleMemoCheckboxLine(body: unknown, lineIndex: number, checked: boolean): string;

export function insertMemoCheckbox(body: unknown, selectionStart?: number, selectionEnd?: number): MemoCheckboxInsertion;

export type Memo = {
  id: MemoId;
  title: string;
  body: string;
  favorite: boolean;
  category: MemoCategory | null;
  color: MemoStickyColor | null;
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
  color?: MemoStickyColor | null;
};

export type MemoCategoryCreateInput = {
  label: string;
  description?: string;
  parentId?: string | null;
};

export type MemoCategoryUpdateInput = {
  label?: string;
  description?: string;
  parentId?: string | null;
};

export type MemoUpdateInput = {
  title?: string;
  body?: string;
  favorite?: boolean;
  category?: MemoCategory | null;
  color?: MemoStickyColor | null;
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
