import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const MEMO_STORE_VERSION = 1;
const MEMO_STORE_FILENAME = "memos.json";
const LEGACY_NOTE_STORE_FILENAME = "notes.json";

function normalizeTimestamp(value) {
  return typeof value === "string" && value.length > 0 ? value : new Date().toISOString();
}

function normalizeTitle(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeBody(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function normalizeMemo(memo) {
  return {
    id: typeof memo.id === "string" && memo.id.length > 0 ? memo.id : randomUUID(),
    title: normalizeTitle(memo.title),
    body: normalizeBody(memo.body),
    createdAt: normalizeTimestamp(memo.createdAt),
    updatedAt: normalizeTimestamp(memo.updatedAt)
  };
}

function cloneMemo(memo) {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

function sortMemosByUpdatedAt(memos) {
  return [...memos].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function ensureParentDirectory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

function parseStorePayload(parsed) {
  if (Array.isArray(parsed.memos)) {
    return {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(parsed.memos.map(normalizeMemo))
    };
  }

  if (Array.isArray(parsed.notes)) {
    return {
      version: MEMO_STORE_VERSION,
      memos: sortMemosByUpdatedAt(parsed.notes.map(normalizeMemo))
    };
  }

  return {
    version: MEMO_STORE_VERSION,
    memos: []
  };
}

async function readStore(filePath, legacyFilePath) {
  try {
    const fileContents = await readFile(filePath, "utf8");
    return parseStorePayload(JSON.parse(fileContents));
  } catch (error) {
    if (error.code === "ENOENT") {
      if (legacyFilePath) {
        try {
          const legacyContents = await readFile(legacyFilePath, "utf8");
          return parseStorePayload(JSON.parse(legacyContents));
        } catch (legacyError) {
          if (legacyError.code !== "ENOENT") {
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

        const nextMemo = normalizeMemo({
          ...currentMemo,
          title: updates.title ?? currentMemo.title,
          body: updates.body ?? currentMemo.body,
          updatedAt: new Date().toISOString()
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
