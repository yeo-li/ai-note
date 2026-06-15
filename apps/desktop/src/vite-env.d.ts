/// <reference types="vite/client" />

import type {
  MemoChangeEvent,
} from "@ai-note/shared/memo";
import type {
  CreateMemoRequest,
  CreateMemoResponse,
  CreateMemoCategoryRequest,
  CreateMemoCategoryResponse,
  DeleteMemoRequest,
  DeleteMemoResponse,
  DeleteMemoCategoryRequest,
  DeleteMemoCategoryResponse,
  GetMemoRequest,
  GetMemoResponse,
  ListMemoCategoriesResponse,
  ListMemosResponse,
  OrganizeMemoRequest,
  OrganizeMemoResponse,
  SearchMemosRequest,
  SearchMemosResponse,
  UpdateMemoRequest,
  UpdateMemoResponse,
  UpdateMemoCategoryRequest,
  UpdateMemoCategoryResponse
} from "@ai-note/shared/memo-api";
import type { MemoStoreHealth } from "./shared/memo-bridge";
import type { PromptTemplate, PromptTemplateCreateInput, PromptTemplateUpdateInput } from "./shared/prompt-template-bridge";
import type { Memo } from "@ai-note/shared/memo";

type ContextSearchResult = {
  memo: Memo;
  preview: string;
  reason: string;
};

type DesktopAPI = {
  platform: string;
  window?: {
    openStickyNote: (noteId?: string | null) => Promise<boolean>;
    setStickyPinned: (pinned: boolean) => Promise<boolean>;
    openQuickCapture: () => Promise<boolean>;
    closeQuickCapture: () => Promise<boolean>;
  };
  clipboard?: {
    writeText: (text: string) => void;
  };
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};

type MemoAPI = {
  health(): Promise<MemoStoreHealth>;
  list(): Promise<ListMemosResponse["memos"]>;
  get(id: GetMemoRequest["memoId"]): Promise<GetMemoResponse["memo"]>;
  create(input: CreateMemoRequest["input"]): Promise<CreateMemoResponse["memo"]>;
  update(id: UpdateMemoRequest["memoId"], patch: UpdateMemoRequest["patch"]): Promise<UpdateMemoResponse["memo"]>;
  delete(id: DeleteMemoRequest["memoId"]): Promise<DeleteMemoResponse["deleted"]>;
  listCategories(): Promise<ListMemoCategoriesResponse["categories"]>;
  createCategory(input: CreateMemoCategoryRequest["input"]): Promise<CreateMemoCategoryResponse["category"]>;
  updateCategory(categoryId: UpdateMemoCategoryRequest["categoryId"], patch: UpdateMemoCategoryRequest["patch"]): Promise<UpdateMemoCategoryResponse["category"]>;
  deleteCategory(categoryId: DeleteMemoCategoryRequest["categoryId"]): Promise<DeleteMemoCategoryResponse["category"]>;
  search(query: SearchMemosRequest["query"]): Promise<SearchMemosResponse["results"]>;
  aiSearch(query: string): Promise<ContextSearchResult[]>;
  organizeState(): Promise<string[]>;
  organize(input: OrganizeMemoRequest["input"]): Promise<OrganizeMemoResponse["result"]>;
  compose(input: { prompt: string; intent: "polish" | "polite" }): Promise<
    | {
        kind: "composed";
        title: string;
        body: string;
        relatedMemoIds: string[];
        relatedCount: number;
        sourceMemoIds: string[];
        sourceCount: number;
      }
    | {
        kind: "refused";
        refusalReason: "no_related_memos" | "insufficient_support";
        message: string;
        relatedMemoIds: string[];
        relatedCount: number;
      }
  >;
  categorizeState(): Promise<string[]>;
  categorize(memoId: string): Promise<Memo | null>;
  categorizeAllState(): Promise<boolean>;
  categorizeAll(): Promise<{ processed: number; updated: number; memos: Memo[] }>;
  onDidChange(listener: (event: MemoChangeEvent) => void): () => void;
  onDidOrganizeState(listener: (event: { memoId: string; busy: boolean }) => void): () => void;
  onDidCategorizeState(listener: (event: { memoId: string; busy: boolean }) => void): () => void;
  onDidCategorizeAllState(listener: (busy: boolean) => void): () => void;
  onDidCategoriesChange(listener: (categories: ListMemoCategoriesResponse["categories"]) => void): () => void;
};

type PromptTemplateAPI = {
  list(): Promise<PromptTemplate[]>;
  create(input: PromptTemplateCreateInput): Promise<PromptTemplate>;
  update(id: string, patch: PromptTemplateUpdateInput): Promise<PromptTemplate | null>;
  delete(id: string): Promise<boolean>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
    memoAPI?: MemoAPI;
    promptTemplateAPI?: PromptTemplateAPI;
  }
}

export {};
