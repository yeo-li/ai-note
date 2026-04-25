import { randomUUID } from "node:crypto";

export const PROMPT_TEMPLATE_STORE_VERSION = 1;
export const PROMPT_TEMPLATE_STORE_FILENAME = "prompt-templates.json";

function normalizeTimestamp(value) {
  return typeof value === "string" && value.length > 0 ? value : new Date().toISOString();
}

function normalizeName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizePrompt(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function normalizePromptTemplate(template) {
  return {
    id: typeof template.id === "string" && template.id.length > 0 ? template.id : randomUUID(),
    name: normalizeName(template.name),
    prompt: normalizePrompt(template.prompt),
    createdAt: normalizeTimestamp(template.createdAt),
    updatedAt: normalizeTimestamp(template.updatedAt)
  };
}

export function clonePromptTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    prompt: template.prompt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

export function sortPromptTemplatesByUpdatedAt(templates) {
  return [...templates].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function parsePromptTemplateStorePayload(parsed) {
  if (Array.isArray(parsed.templates)) {
    return {
      version: PROMPT_TEMPLATE_STORE_VERSION,
      templates: sortPromptTemplatesByUpdatedAt(parsed.templates.map(normalizePromptTemplate))
    };
  }

  return {
    version: PROMPT_TEMPLATE_STORE_VERSION,
    templates: []
  };
}
