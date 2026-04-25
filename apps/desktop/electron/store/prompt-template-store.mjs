import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PROMPT_TEMPLATE_STORE_FILENAME,
  PROMPT_TEMPLATE_STORE_VERSION,
  clonePromptTemplate,
  normalizePromptTemplate,
  parsePromptTemplateStorePayload,
  sortPromptTemplatesByUpdatedAt
} from "./prompt-template-store-model.mjs";

async function ensureParentDirectory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function readStore(filePath) {
  try {
    const fileContents = await readFile(filePath, "utf8");
    return parsePromptTemplateStorePayload(JSON.parse(fileContents));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        version: PROMPT_TEMPLATE_STORE_VERSION,
        templates: []
      };
    }

    throw error;
  }
}

async function writeStore(filePath, store) {
  const tempPath = `${filePath}.tmp`;
  const payload = JSON.stringify(
    {
      version: PROMPT_TEMPLATE_STORE_VERSION,
      templates: sortPromptTemplatesByUpdatedAt(store.templates)
    },
    null,
    2
  );

  await ensureParentDirectory(filePath);
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
}

export function createPromptTemplateStore({ userDataPath }) {
  const filePath = join(userDataPath, PROMPT_TEMPLATE_STORE_FILENAME);
  let operationQueue = Promise.resolve();

  function runSerialized(task) {
    const nextOperation = operationQueue.then(task, task);
    operationQueue = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  return {
    filePath,

    async list() {
      return runSerialized(async () => {
        const store = await readStore(filePath);
        return store.templates.map(clonePromptTemplate);
      });
    },

    async create(input = {}) {
      return runSerialized(async () => {
        const now = new Date().toISOString();
        const template = normalizePromptTemplate({
          id: input.id,
          name: input.name,
          prompt: input.prompt,
          createdAt: now,
          updatedAt: now
        });
        const store = await readStore(filePath);

        store.templates = [template, ...store.templates.filter((currentTemplate) => currentTemplate.id !== template.id)];
        await writeStore(filePath, store);

        return clonePromptTemplate(template);
      });
    },

    async update(templateId, updates = {}) {
      return runSerialized(async () => {
        const store = await readStore(filePath);
        const currentTemplate = store.templates.find((template) => template.id === templateId);

        if (!currentTemplate) {
          return null;
        }

        const nextTemplate = normalizePromptTemplate({
          ...currentTemplate,
          name: updates.name ?? currentTemplate.name,
          prompt: updates.prompt ?? currentTemplate.prompt,
          createdAt: currentTemplate.createdAt,
          updatedAt: new Date().toISOString()
        });

        store.templates = [nextTemplate, ...store.templates.filter((template) => template.id !== templateId)];
        await writeStore(filePath, store);

        return clonePromptTemplate(nextTemplate);
      });
    },

    async delete(templateId) {
      return runSerialized(async () => {
        const store = await readStore(filePath);
        const nextTemplates = store.templates.filter((template) => template.id !== templateId);

        if (nextTemplates.length === store.templates.length) {
          return false;
        }

        store.templates = nextTemplates;
        await writeStore(filePath, store);

        return true;
      });
    }
  };
}
