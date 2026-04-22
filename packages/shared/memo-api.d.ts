import type {
  Memo,
  MemoCreateInput,
  MemoId,
  MemoOrganizeInput,
  MemoOrganizeResult,
  MemoSearchResult,
  MemoUpdateInput
} from "./memo";

export type ListMemosResponse = {
  memos: Memo[];
};

export type GetMemoRequest = {
  memoId: MemoId;
};

export type GetMemoResponse = {
  memo: Memo | null;
};

export type CreateMemoRequest = {
  input: MemoCreateInput;
};

export type CreateMemoResponse = {
  memo: Memo;
};

export type UpdateMemoRequest = {
  memoId: MemoId;
  patch: MemoUpdateInput;
};

export type UpdateMemoResponse = {
  memo: Memo | null;
};

export type DeleteMemoRequest = {
  memoId: MemoId;
};

export type DeleteMemoResponse = {
  deleted: boolean;
  memoId: MemoId;
};

export type SearchMemosRequest = {
  query: string;
};

export type SearchMemosResponse = {
  query: string;
  results: MemoSearchResult[];
};

export type OrganizeMemoRequest = {
  input: MemoOrganizeInput;
};

export type OrganizeMemoResponse = {
  result: MemoOrganizeResult;
};
