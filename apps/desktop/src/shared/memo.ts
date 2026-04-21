export type Memo = {
  id: string;
  title: string;
  body: string;
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
      memoId: string;
    };

export type MemoCreateInput = {
  title?: string;
  body?: string;
};

export type MemoUpdateInput = {
  title?: string;
  body?: string;
};

export type MemoSearchResult = {
  memo: Memo;
  score: number;
  preview: string;
  matchedTerms: string[];
};

export type MemoOrganizeIntent = "polish" | "polite";

export type MemoOrganizeInput = {
  memoId: string;
  title?: string;
  body: string;
  intent: MemoOrganizeIntent;
};

export type MemoOrganizeResult = {
  intent: MemoOrganizeIntent;
  original: string;
  suggested: string;
  summary: string;
};

export type MemoStoreKind = "sqlite" | "json" | "memory";

export type MemoStoreHealth = {
  bridgeConnected: boolean;
  ready: boolean;
  storeKind: MemoStoreKind;
  filePath?: string;
  fallbackReason?: string;
  errorMessage?: string;
};
