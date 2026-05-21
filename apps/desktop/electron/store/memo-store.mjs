import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  LEGACY_NOTE_STORE_FILENAME,
  MEMO_STORE_FILENAME,
  MEMO_STORE_VERSION,
  cloneMemo,
  createTimestampAfter,
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
        memos: []
      };
    }

    throw error;
  }
}

async function writeStore(filePath, store) {
  const tempPath = `${filePath}.tmp`;
  const payload = JSON.stringify(
    {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(store.memos)
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
          createdAt: now,
          updatedAt: now
        });
        const store = await readStore(filePath, legacyFilePath);

        store.memos = [memo, ...store.memos.filter((currentMemo) => currentMemo.id !== memo.id)];
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
          updatedAt: shouldRefreshTimestamp ? createTimestampAfter(store.memos.map((memo) => memo.updatedAt)) : currentMemo.updatedAt
        });

        store.memos = [nextMemo, ...store.memos.filter((memo) => memo.id !== memoId)];
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
    }
  };
}
