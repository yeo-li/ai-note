/// <reference types="vite/client" />

import type {
  MemoChangeEvent,
} from "@ai-note/shared/memo";
import type {
  CreateMemoRequest,
  CreateMemoResponse,
  DeleteMemoRequest,
  DeleteMemoResponse,
  GetMemoRequest,
  GetMemoResponse,
  ListMemosResponse,
  OrganizeMemoRequest,
  OrganizeMemoResponse,
  SearchMemosRequest,
  SearchMemosResponse,
  UpdateMemoRequest,
  UpdateMemoResponse
} from "@ai-note/shared/memo-api";
import type { MemoStoreHealth } from "./shared/memo-bridge";

type DesktopAPI = {
  platform: string;
  window?: {
    openStickyNote: (noteId?: string | null) => Promise<boolean>;
    setStickyPinned: (pinned: boolean) => Promise<boolean>;
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
  search(query: SearchMemosRequest["query"]): Promise<SearchMemosResponse["results"]>;
  organizeState(): Promise<string[]>;
  organize(input: OrganizeMemoRequest["input"]): Promise<OrganizeMemoResponse["result"]>;
  compose(input: { memoIds: string[]; prompt: string; intent: "polish" | "polite" }): Promise<{ result: OrganizeMemoResponse["result"]; sourceMemoIds: string[]; sourceCount: number }>;
  onDidChange(listener: (event: MemoChangeEvent) => void): () => void;
  onDidOrganizeState(listener: (event: { memoId: string; busy: boolean }) => void): () => void;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
    memoAPI?: MemoAPI;
  }
}

export {};
