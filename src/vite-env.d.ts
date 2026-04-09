/// <reference types="vite/client" />

import type { Memo, MemoCreateInput, MemoSearchResult, MemoUpdateInput } from "./shared/memo";

type DesktopAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};

type MemoAPI = {
  list(): Promise<Memo[]>;
  get(id: string): Promise<Memo | null>;
  create(input?: MemoCreateInput): Promise<Memo>;
  update(id: string, patch?: MemoUpdateInput): Promise<Memo | null>;
  delete(id: string): Promise<boolean>;
  search(query: string): Promise<MemoSearchResult[]>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
    memoAPI?: MemoAPI;
  }
}

export {};
