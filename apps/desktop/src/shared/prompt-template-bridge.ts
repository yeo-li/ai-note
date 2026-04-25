export type PromptTemplate = {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptTemplateCreateInput = {
  name: string;
  prompt: string;
};

export type PromptTemplateUpdateInput = {
  name?: string;
  prompt?: string;
};
