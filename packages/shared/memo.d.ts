export type MemoId = string;

export type Memo = {
  id: MemoId;
  title: string;
  body: string;
  favorite: boolean;
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
};

export type MemoUpdateInput = {
  title?: string;
  body?: string;
  favorite?: boolean;
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
};

export type MemoOrganizeResult = {
  intent: MemoOrganizeIntent;
  original: string;
  suggested: string;
  summary: string;
};
