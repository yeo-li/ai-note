import assert from "node:assert/strict";
import test from "node:test";
import { createMemoSyncStore } from "./memo-sync-store.mjs";

function createFakeMemoStore(initialMemos = []) {
  const memos = new Map(initialMemos.map((memo) => [memo.id, memo]));

  return {
    async create(input) {
      const memo = { id: input.id ?? `memo-${memos.size + 1}`, title: "", body: "", favorite: false, category: null, color: null, ...input };
      memos.set(memo.id, memo);
      return memo;
    },
    async update(memoId, updates) {
      const memo = memos.get(memoId);

      if (!memo) {
        return null;
      }

      const nextMemo = { ...memo, ...updates };
      memos.set(memoId, nextMemo);
      return nextMemo;
    },
    async delete(memoId) {
      return memos.delete(memoId);
    },
    async get(memoId) {
      return memos.get(memoId) ?? null;
    },
    async replace(memo) {
      memos.set(memo.id, { ...memo });
      return memo;
    }
  };
}

function createFakeQueue() {
  const operations = [];

  return {
    operations,
    async enqueueUpsert(memo) {
      operations.splice(0, operations.length, ...operations.filter((op) => op.memoId !== memo.id), { id: `${operations.length}`, type: "upsert", memoId: memo.id, memo });
    },
    async enqueueDelete(memoId) {
      operations.splice(0, operations.length, ...operations.filter((op) => op.memoId !== memoId), { id: `${operations.length}`, type: "delete", memoId });
    },
    async list() {
      return [...operations];
    },
    async remove(operationId) {
      const index = operations.findIndex((op) => op.id === operationId);

      if (index >= 0) {
        operations.splice(index, 1);
      }
    }
  };
}

test("create pushes the new memo to the server", async () => {
  const memoStore = createFakeMemoStore();
  const queue = createFakeQueue();
  const pushedUpserts = [];
  const serverClient = {
    async upsert(memoId, memo) {
      pushedUpserts.push({ memoId, memo });
    },
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  const memo = await syncStore.create({ title: "제목" });

  assert.equal(pushedUpserts.length, 1);
  assert.equal(pushedUpserts[0].memoId, memo.id);
  assert.deepEqual(await queue.list(), []);
});

test("create enqueues the memo when the server is unreachable", async () => {
  const memoStore = createFakeMemoStore();
  const queue = createFakeQueue();
  const serverClient = {
    async upsert() {
      throw new Error("network error");
    },
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  const memo = await syncStore.create({ title: "제목" });

  const operations = await queue.list();
  assert.equal(operations.length, 1);
  assert.equal(operations[0].type, "upsert");
  assert.equal(operations[0].memoId, memo.id);
});

test("flushQueue retries queued operations and stops at the first failure", async () => {
  const memoStore = createFakeMemoStore();
  const queue = createFakeQueue();
  await queue.enqueueUpsert({ id: "memo-1", title: "첫번째" });
  await queue.enqueueUpsert({ id: "memo-2", title: "두번째" });

  let callCount = 0;
  const serverClient = {
    async upsert(memoId) {
      callCount += 1;

      if (memoId === "memo-2") {
        throw new Error("network error");
      }
    },
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.flushQueue();

  assert.equal(callCount, 2);
  const remaining = await queue.list();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].memoId, "memo-2");
});

test("pullFromServer applies a remote memo that does not exist locally", async () => {
  const memoStore = createFakeMemoStore();
  const queue = createFakeQueue();
  const serverClient = {
    async list() {
      return [{ id: "memo-1", title: "원격 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-02T00:00:00.000Z" }];
    },
    async listDeletions() { return []; },
    async upsert() {},
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.pullFromServer();

  const stored = await memoStore.get("memo-1");
  assert.equal(stored.title, "원격 메모");
});

test("pullFromServer overwrites a local memo when the remote one is newer", async () => {
  const memoStore = createFakeMemoStore([
    { id: "memo-1", title: "로컬 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-01T00:00:00.000Z" }
  ]);
  const queue = createFakeQueue();
  const serverClient = {
    async list() {
      return [{ id: "memo-1", title: "서버 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-02T00:00:00.000Z" }];
    },
    async listDeletions() { return []; },
    async upsert() {},
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.pullFromServer();

  const stored = await memoStore.get("memo-1");
  assert.equal(stored.title, "서버 메모");
});

test("pullFromServer keeps the local memo when it is newer than the remote one", async () => {
  const memoStore = createFakeMemoStore([
    { id: "memo-1", title: "로컬 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-02T00:00:00.000Z" }
  ]);
  const queue = createFakeQueue();
  const serverClient = {
    async list() {
      return [{ id: "memo-1", title: "서버 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-01T00:00:00.000Z" }];
    },
    async listDeletions() { return []; },
    async upsert() {},
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.pullFromServer();

  const stored = await memoStore.get("memo-1");
  assert.equal(stored.title, "로컬 메모");
});

test("pullFromServer deletes a local memo when the server tombstone is newer", async () => {
  const memoStore = createFakeMemoStore([
    { id: "memo-1", title: "로컬 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-01T00:00:00.000Z" }
  ]);
  const queue = createFakeQueue();
  const serverClient = {
    async list() { return []; },
    async listDeletions() {
      return [{ memoId: "memo-1", deletedAt: "2026-01-02T00:00:00.000Z" }];
    },
    async upsert() {},
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.pullFromServer();

  assert.equal(await memoStore.get("memo-1"), null);
});

test("pullFromServer keeps a local memo when it was updated after the server tombstone", async () => {
  const memoStore = createFakeMemoStore([
    { id: "memo-1", title: "새로 수정된 메모", body: "", favorite: false, category: null, color: null, updatedAt: "2026-01-03T00:00:00.000Z" }
  ]);
  const queue = createFakeQueue();
  const serverClient = {
    async list() { return []; },
    async listDeletions() {
      return [{ memoId: "memo-1", deletedAt: "2026-01-02T00:00:00.000Z" }];
    },
    async upsert() {},
    async delete() {}
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  await syncStore.pullFromServer();

  const stored = await memoStore.get("memo-1");
  assert.equal(stored?.title, "새로 수정된 메모");
});

test("delete pushes deletion to the server and clears queued upserts for the memo", async () => {
  const memoStore = createFakeMemoStore([{ id: "memo-1", title: "제목" }]);
  const queue = createFakeQueue();
  await queue.enqueueUpsert({ id: "memo-1", title: "제목" });

  const pushedDeletes = [];
  const serverClient = {
    async upsert() {},
    async delete(memoId) {
      pushedDeletes.push(memoId);
    }
  };
  const syncStore = createMemoSyncStore({ memoStore, serverClient, queue });

  const deleted = await syncStore.delete("memo-1");

  assert.equal(deleted, true);
  assert.deepEqual(pushedDeletes, ["memo-1"]);
  assert.deepEqual(await queue.list(), []);
});
