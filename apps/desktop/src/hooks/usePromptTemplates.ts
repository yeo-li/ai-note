import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PromptTemplate } from "../shared/prompt-template-bridge";
import { buildDefaultTemplateName } from "../domain/prompt-template";
import type { TransformSession } from "../domain/transform";
import {
  createPromptTemplate,
  deletePromptTemplate,
  isPromptTemplateRepositoryAvailable,
  listPromptTemplates,
  updatePromptTemplate
} from "../infrastructure/prompt-template-repository";

export type PromptTemplateEditorState = {
  isOpen: boolean;
  templateId: string | null;
  name: string;
  prompt: string;
};

const initialEditorState: PromptTemplateEditorState = { isOpen: false, templateId: null, name: "", prompt: "" };

type UsePromptTemplatesParams = {
  activeAiPrompt: string;
  updateActiveTransformSession: (updater: (session: TransformSession) => TransformSession) => void;
  setStatusMessage: (message: string) => void;
};

type PromptTemplateState = ReturnType<typeof usePromptTemplateState>;
type PromptTemplateContext = UsePromptTemplatesParams & PromptTemplateState;

export function usePromptTemplates(params: UsePromptTemplatesParams) {
  const state = usePromptTemplateState();
  const context = { ...params, ...state };

  usePromptTemplateBootstrap(state.setPromptTemplates);

  return {
    ...state,
    closePromptTemplateEditor: () => closePromptTemplateEditor(state.setPromptTemplateEditor),
    openPromptTemplateEditor: (template?: PromptTemplate) => openPromptTemplateEditor(template, context),
    applyPromptTemplate: (template: PromptTemplate) => applyPromptTemplate(template, context),
    persistPromptTemplate: () => persistPromptTemplate(context),
    removePromptTemplate: (templateId: string) => removePromptTemplate(templateId, context)
  };
}

function usePromptTemplateState() {
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [promptTemplateEditor, setPromptTemplateEditor] = useState<PromptTemplateEditorState>(initialEditorState);
  return { promptTemplates, setPromptTemplates, promptTemplateEditor, setPromptTemplateEditor };
}

function usePromptTemplateBootstrap(setPromptTemplates: Dispatch<SetStateAction<PromptTemplate[]>>) {
  useEffect(() => {
    if (!isPromptTemplateRepositoryAvailable()) return;
    let cancelled = false;
    void listPromptTemplates().then((templates) => {
      if (!cancelled) setPromptTemplates(templates);
    });
    return () => {
      cancelled = true;
    };
  }, [setPromptTemplates]);
}

function closePromptTemplateEditor(setPromptTemplateEditor: Dispatch<SetStateAction<PromptTemplateEditorState>>) {
  setPromptTemplateEditor(initialEditorState);
}

function openPromptTemplateEditor(template: PromptTemplate | undefined, context: PromptTemplateContext) {
  const nextPrompt = template?.prompt ?? context.activeAiPrompt;
  context.setPromptTemplateEditor(createEditorState(template, nextPrompt, context.promptTemplates));
}

function createEditorState(template: PromptTemplate | undefined, prompt: string, promptTemplates: PromptTemplate[]) {
  return {
    isOpen: true,
    templateId: template?.id ?? null,
    name: template?.name ?? buildDefaultTemplateName(prompt, promptTemplates),
    prompt
  };
}

function applyPromptTemplate(template: PromptTemplate, context: PromptTemplateContext) {
  context.updateActiveTransformSession((session) => ({ ...session, prompt: template.prompt }));
  context.setStatusMessage(`"${template.name}" 템플릿을 불러왔어요.`);
}

async function persistPromptTemplate(context: PromptTemplateContext) {
  if (!canPersistPromptTemplate(context)) return;
  const input = getPromptTemplateInput(context.promptTemplateEditor);
  if (!input) return context.setStatusMessage("템플릿 이름과 프롬프트를 함께 입력해 주세요.");

  try {
    await persistValidPromptTemplate(input, context);
    closePromptTemplateEditor(context.setPromptTemplateEditor);
  } catch (error) {
    context.setStatusMessage(error instanceof Error ? error.message : "프롬프트 템플릿을 저장하지 못했어요.");
  }
}

function canPersistPromptTemplate(context: PromptTemplateContext) {
  if (isPromptTemplateRepositoryAvailable()) return true;
  context.setStatusMessage("프롬프트 템플릿 저장소를 찾지 못했어요.");
  return false;
}

function getPromptTemplateInput(editor: PromptTemplateEditorState) {
  const name = editor.name.trim();
  const prompt = editor.prompt.trim();
  return name && prompt ? { name, prompt, templateId: editor.templateId } : null;
}

async function persistValidPromptTemplate(input: { name: string; prompt: string; templateId: string | null }, context: PromptTemplateContext) {
  if (input.templateId) {
    await persistUpdatedTemplate({ ...input, templateId: input.templateId }, context);
    return;
  }

  await persistCreatedTemplate(input, context);
}

async function persistUpdatedTemplate(input: { name: string; prompt: string; templateId: string }, context: PromptTemplateContext) {
  const updatedTemplate = await updatePromptTemplate(input.templateId, { name: input.name, prompt: input.prompt });
  if (!updatedTemplate) return context.setStatusMessage("수정할 템플릿을 찾지 못했어요.");
  upsertPromptTemplate(updatedTemplate, context);
  context.setStatusMessage(`"${updatedTemplate.name}" 템플릿을 수정했어요.`);
}

async function persistCreatedTemplate(input: { name: string; prompt: string }, context: PromptTemplateContext) {
  const createdTemplate = await createPromptTemplate({ name: input.name, prompt: input.prompt });
  upsertPromptTemplate(createdTemplate, context);
  context.setStatusMessage(`"${createdTemplate.name}" 템플릿을 저장했어요.`);
}

function upsertPromptTemplate(template: PromptTemplate, context: PromptTemplateContext) {
  context.setPromptTemplates((currentTemplates) => [template, ...currentTemplates.filter((item) => item.id !== template.id)]);
  context.updateActiveTransformSession((session) => ({ ...session, prompt: template.prompt }));
}

async function removePromptTemplate(templateId: string, context: PromptTemplateContext) {
  if (!canPersistPromptTemplate(context)) return;

  try {
    await deleteExistingPromptTemplate(templateId, context);
  } catch (error) {
    context.setStatusMessage(error instanceof Error ? error.message : "프롬프트 템플릿을 삭제하지 못했어요.");
  }
}

async function deleteExistingPromptTemplate(templateId: string, context: PromptTemplateContext) {
  const targetTemplate = context.promptTemplates.find((template) => template.id === templateId) ?? null;
  const deleted = await deletePromptTemplate(templateId);
  if (!deleted) return context.setStatusMessage("삭제할 템플릿을 찾지 못했어요.");
  context.setPromptTemplates((currentTemplates) => currentTemplates.filter((template) => template.id !== templateId));
  if (context.promptTemplateEditor.templateId === templateId) closePromptTemplateEditor(context.setPromptTemplateEditor);
  context.setStatusMessage(targetTemplate ? `"${targetTemplate.name}" 템플릿을 삭제했어요.` : "템플릿을 삭제했어요.");
}
