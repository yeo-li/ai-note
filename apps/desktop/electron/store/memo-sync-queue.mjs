import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const MEMO_SYNC_QUEUE_FILENAME = "memo-sync-queue.json";

async function ensureParentDirectory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function readQueueFile(filePath) {
  try {
    const fileContents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(fileContents);
    return Array.isArray(parsed.operations) ? parsed.operations : [];
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) {
      return [];
    }

    throw error;
  }
}

async function writeQueueFile(filePath, operations) {
  const tempPath = `${filePath}.tmp`;

  await ensureParentDirectory(filePath);
  await writeFile(tempPath, JSON.stringify({ operations }, null, 2), "utf8");
  await rename(tempPath, filePath);
}

/**
 * 서버 동기화에 실패한 메모 변경 사항을 보관하는 오프라인 큐.
 * 같은 메모에 대한 변경은 최신 것만 유지해 큐가 무한히 커지지 않도록 한다.
 */
export function createMemoSyncQueue({ filePath }) {
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

    async enqueueUpsert(memo) {
      return runSerialized(async () => {
        const operations = await readQueueFile(filePath);
        const nextOperations = [
          ...operations.filter((operation) => operation.memoId !== memo.id),
          { id: randomUUID(), type: "upsert", memoId: memo.id, memo }
        ];
        await writeQueueFile(filePath, nextOperations);
      });
    },

    async enqueueDelete(memoId) {
      return runSerialized(async () => {
        const operations = await readQueueFile(filePath);
        const nextOperations = [...operations.filter((operation) => operation.memoId !== memoId), { id: randomUUID(), type: "delete", memoId }];
        await writeQueueFile(filePath, nextOperations);
      });
    },

    async list() {
      return runSerialized(async () => readQueueFile(filePath));
    },

    async remove(operationId) {
      return runSerialized(async () => {
        const operations = await readQueueFile(filePath);
        await writeQueueFile(
          filePath,
          operations.filter((operation) => operation.id !== operationId)
        );
      });
    }
  };
}
