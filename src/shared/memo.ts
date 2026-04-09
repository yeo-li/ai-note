export type MemoRecord = {
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
