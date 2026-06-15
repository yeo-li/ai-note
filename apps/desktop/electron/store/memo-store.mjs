import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  LEGACY_NOTE_STORE_FILENAME,
  MEMO_STORE_FILENAME,
  MEMO_STORE_VERSION,
  cloneMemo,
  createBuiltinCategoryDefinitions,
  createCategoryDefinitionFromLabel,
  createTimestampAfter,
  mergeCategoryDefinitions,
  normalizeCategoryUpdateInput,
  normalizeMemo,
  parseStorePayload,
  sortMemosByUpdatedAt
} from "./memo-store-model.mjs";

async function ensureParentDirectory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

function isJsonParseError(error) {
  return error instanceof SyntaxError;
}

function createCorruptBackupPath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  return join(dirname(filePath), `${basename(filePath)}.corrupt-${timestamp}`);
}

async function moveCorruptStoreFile(filePath) {
  await rename(filePath, createCorruptBackupPath(filePath));
}

async function readStoreFile(filePath) {
  try {
    const fileContents = await readFile(filePath, "utf8");
    return parseStorePayload(JSON.parse(fileContents));
  } catch (error) {
    if (isJsonParseError(error)) {
      await moveCorruptStoreFile(filePath);
    }

    throw error;
  }
}

async function readStore(filePath, legacyFilePath) {
  try {
    return await readStoreFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || isJsonParseError(error)) {
      if (legacyFilePath) {
        try {
          return await readStoreFile(legacyFilePath);
        } catch (legacyError) {
          if (legacyError.code !== "ENOENT" && !isJsonParseError(legacyError)) {
            throw legacyError;
          }
        }
      }

      return {
      version: MEMO_STORE_VERSION,
      memos: [],
      categories: createBuiltinCategoryDefinitions()
    };
    }

    throw error;
  }
}

async function writeStore(filePath, store) {
  const tempPath = `${filePath}.tmp`;
  const categories = store.categories && store.categories.length > 0 ? store.categories : createBuiltinCategoryDefinitions();
  const payload = JSON.stringify(
    {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(store.memos),
      categories: mergeCategoryDefinitions(categories)
    },
    null,
    2
  );

  await ensureParentDirectory(filePath);
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
}

export function createMemoStore({ userDataPath }) {
  const filePath = join(userDataPath, MEMO_STORE_FILENAME);
  const legacyFilePath = join(userDataPath, LEGACY_NOTE_STORE_FILENAME);
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
        const store = await readStore(filePath, legacyFilePath);
        return store.memos.map(cloneMemo);
      });
    },

    async get(memoId) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const memo = store.memos.find((currentMemo) => currentMemo.id === memoId);
        return memo ? cloneMemo(memo) : null;
      });
    },

    async create(input = {}) {
      return runSerialized(async () => {
        const now = new Date().toISOString();
        const memo = normalizeMemo({
          id: randomUUID(),
          title: input.title ?? "",
          body: input.body ?? "",
          favorite: input.favorite ?? false,
          category: input.category ?? null,
          color: input.color ?? null,
          createdAt: now,
          updatedAt: now
        });
        const store = await readStore(filePath, legacyFilePath);

        store.memos = [memo, ...store.memos.filter((currentMemo) => currentMemo.id !== memo.id)];
        store.categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), [createCategoryFromMemo(memo)].filter(Boolean));
        await writeStore(filePath, store);

        return cloneMemo(memo);
      });
    },

    async update(memoId, updates = {}) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const currentMemo = store.memos.find((memo) => memo.id === memoId);

        if (!currentMemo) {
          return null;
        }

        const shouldRefreshTimestamp = typeof updates.title === "string" || typeof updates.body === "string";

        const nextMemo = normalizeMemo({
          ...currentMemo,
          title: updates.title ?? currentMemo.title,
          body: updates.body ?? currentMemo.body,
          favorite: typeof updates.favorite === "boolean" ? updates.favorite : currentMemo.favorite,
          category: typeof updates.category !== "undefined" ? updates.category : currentMemo.category,
          color: typeof updates.color !== "undefined" ? updates.color : currentMemo.color,
          updatedAt: shouldRefreshTimestamp ? createTimestampAfter(store.memos.map((memo) => memo.updatedAt)) : currentMemo.updatedAt
        });

        store.memos = [nextMemo, ...store.memos.filter((memo) => memo.id !== memoId)];
        store.categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), [createCategoryFromMemo(nextMemo)].filter(Boolean));
        await writeStore(filePath, store);

        return cloneMemo(nextMemo);
      });
    },

    async delete(memoId) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const nextMemos = store.memos.filter((memo) => memo.id !== memoId);

        if (nextMemos.length === store.memos.length) {
          return false;
        }

        store.memos = nextMemos;
        await writeStore(filePath, store);

        return true;
      });
    },

    async replace(memo) {
      return runSerialized(async () => {
        const normalized = normalizeMemo(memo);
        const store = await readStore(filePath, legacyFilePath);

        store.memos = [normalized, ...store.memos.filter((current) => current.id !== normalized.id)];
        store.categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), [createCategoryFromMemo(normalized)].filter(Boolean));
        await writeStore(filePath, store);

        return cloneMemo(normalized);
      });
    },

    async listCategories() {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        return mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), store.memos.map(createCategoryFromMemo).filter(Boolean));
      });
    },

    async createCategory(input = {}) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const category = createCategoryDefinitionFromLabel(input.label, { description: input.description });

        if (!category) {
          throw new Error("카테고리 이름을 확인해 주세요.");
        }

        const categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), store.memos.map(createCategoryFromMemo).filter(Boolean));

        if (hasCategoryDuplicate(categories, category)) {
          throw new Error("이미 있는 카테고리입니다.");
        }

        store.categories = mergeCategoryDefinitions(categories, [category]);
        await writeStore(filePath, store);

        return category;
      });
    },

    async updateCategory(categoryId, patch = {}) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), store.memos.map(createCategoryFromMemo).filter(Boolean));
        const currentCategory = categories.find((category) => category.id === categoryId);

        if (!currentCategory) {
          throw new Error("카테고리를 찾지 못했어요.");
        }

        const updatedCategory = {
          ...currentCategory,
          ...normalizeCategoryUpdateInput(patch),
          updatedAt: new Date().toISOString()
        };

        store.categories = mergeCategoryDefinitions([updatedCategory], categories.filter((category) => category.id !== categoryId));
        await writeStore(filePath, store);

        return updatedCategory;
      });
    },

    async deleteCategory(categoryId) {
      return runSerialized(async () => {
        const store = await readStore(filePath, legacyFilePath);
        const categories = mergeCategoryDefinitions(store.categories ?? createBuiltinCategoryDefinitions(), store.memos.map(createCategoryFromMemo).filter(Boolean));
        const currentCategory = categories.find((category) => category.id === categoryId);

        if (!currentCategory) {
          return { category: null, updatedMemos: [] };
        }

        const updatedMemos = [];

        store.memos = store.memos.map((memo) => {
          if (memo.category !== categoryId) {
            return memo;
          }

          const nextMemo = { ...memo, category: null };
          updatedMemos.push(cloneMemo(nextMemo));
          return nextMemo;
        });

        store.categories = categories.filter((category) => category.id !== categoryId);
        await writeStore(filePath, store);

        return { category: currentCategory, updatedMemos };
      });
    }
  };
}

function createCategoryFromMemo(memo) {
  if (!memo.category) {
    return null;
  }

  return {
    id: memo.category,
    label: memo.category,
    description: "",
    builtin: false,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

function hasCategoryDuplicate(categories, candidate) {
  const normalizedLabel = candidate.label.toLocaleLowerCase("ko-KR");
  return categories.some((category) => category.id === candidate.id || category.label.toLocaleLowerCase("ko-KR") === normalizedLabel);
}
