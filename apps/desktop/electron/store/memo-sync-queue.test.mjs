import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { createMemoSyncQueue } from "./memo-sync-queue.mjs";

async function withTempQueue(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "memo-sync-queue-"));

  try {
    const queue = createMemoSyncQueue({ filePath: path.join(directory, "memo-sync-queue.json") });
    await run(queue);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test("list returns an empty array when no queue file exists", async () => {
  await withTempQueue(async (queue) => {
    assert.deepEqual(await queue.list(), []);
  });
});

test("enqueueUpsert adds an upsert operation", async () => {
  await withTempQueue(async (queue) => {
    await queue.enqueueUpsert({ id: "memo-1", title: "제목" });

    const operations = await queue.list();
    assert.equal(operations.length, 1);
    assert.equal(operations[0].type, "upsert");
    assert.equal(operations[0].memoId, "memo-1");
    assert.deepEqual(operations[0].memo, { id: "memo-1", title: "제목" });
  });
});

test("enqueueUpsert replaces a pending operation for the same memo", async () => {
  await withTempQueue(async (queue) => {
    await queue.enqueueUpsert({ id: "memo-1", title: "첫번째" });
    await queue.enqueueUpsert({ id: "memo-1", title: "두번째" });

    const operations = await queue.list();
    assert.equal(operations.length, 1);
    assert.equal(operations[0].memo.title, "두번째");
  });
});

test("enqueueDelete replaces a pending upsert for the same memo", async () => {
  await withTempQueue(async (queue) => {
    await queue.enqueueUpsert({ id: "memo-1", title: "제목" });
    await queue.enqueueDelete("memo-1");

    const operations = await queue.list();
    assert.equal(operations.length, 1);
    assert.equal(operations[0].type, "delete");
    assert.equal(operations[0].memoId, "memo-1");
  });
});

test("remove deletes an operation by id", async () => {
  await withTempQueue(async (queue) => {
    await queue.enqueueUpsert({ id: "memo-1", title: "제목" });
    const [operation] = await queue.list();

    await queue.remove(operation.id);

    assert.deepEqual(await queue.list(), []);
  });
});
