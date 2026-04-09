export type Memo = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoCreateInput = {
  title?: string;
  body?: string;
};

export type MemoUpdateInput = {
  title?: string;
  body?: string;
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
