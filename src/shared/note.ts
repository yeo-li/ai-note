export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateNoteInput = {
  title?: string;
  body?: string;
};

export type UpdateNoteInput = {
  title?: string;
  body?: string;
};
