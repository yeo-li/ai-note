import type { PromptTemplate, PromptTemplateCreateInput, PromptTemplateUpdateInput } from "../shared/prompt-template-bridge";

/**
 * 프롬프트 템플릿 저장소(Electron promptTemplateAPI)에 대한 단일 접점.
 */
export function isPromptTemplateRepositoryAvailable() {
  return Boolean(window.promptTemplateAPI);
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  if (!window.promptTemplateAPI) {
    throw new Error("프롬프트 템플릿 저장소를 찾지 못했어요.");
  }

  return window.promptTemplateAPI.list();
}

export async function createPromptTemplate(input: PromptTemplateCreateInput): Promise<PromptTemplate> {
  if (!window.promptTemplateAPI) {
    throw new Error("프롬프트 템플릿 저장소를 찾지 못했어요.");
  }

  return window.promptTemplateAPI.create(input);
}

export async function updatePromptTemplate(
  templateId: string,
  patch: PromptTemplateUpdateInput
): Promise<PromptTemplate | null> {
  if (!window.promptTemplateAPI) {
    throw new Error("프롬프트 템플릿 저장소를 찾지 못했어요.");
  }

  return window.promptTemplateAPI.update(templateId, patch);
}

export async function deletePromptTemplate(templateId: string): Promise<boolean> {
  if (!window.promptTemplateAPI) {
    throw new Error("프롬프트 템플릿 저장소를 찾지 못했어요.");
  }

  return window.promptTemplateAPI.delete(templateId);
}
