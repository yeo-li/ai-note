import type { PromptTemplate } from "../shared/prompt-template-bridge";

export function buildDefaultTemplateName(prompt: string, existingTemplates: PromptTemplate[]) {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
    return `새 템플릿 ${existingTemplates.length + 1}`;
  }

  return trimmedPrompt.length <= 18 ? trimmedPrompt : `${trimmedPrompt.slice(0, 18).trim()}…`;
}
