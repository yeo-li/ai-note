/// <reference types="vite/client" />

import type { MemoCreateInput, MemoRecord, MemoUpdateInput } from "./shared/memo";

type DesktopAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};

type MemoAPI = {
  list(): Promise<MemoRecord[]>;
  get(id: string): Promise<MemoRecord | null>;
  create(input?: MemoCreateInput): Promise<MemoRecord>;
  update(id: string, patch?: MemoUpdateInput): Promise<MemoRecord>;
  delete(id: string): Promise<boolean>;
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
    memoAPI?: MemoAPI;
  }
}

export {};
