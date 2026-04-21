import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMemoSqliteStore } from "./memo-sqlite-store.mjs";

async function withTempSqliteStore(run) {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));
  const store = createMemoSqliteStore({ userDataPath });

  try {
    return await run(store, userDataPath);
  } finally {
    store.close();
    await rm(userDataPath, { recursive: true, force: true });
  }
}

test("sqlite memo store starts empty without persisted data", async () => {
  await withTempSqliteStore(async (store) => {
    const memos = await store.list();

    assert.deepEqual(memos, []);
    assert.equal(await store.get("missing-memo"), null);
    assert.equal(await store.update("missing-memo", { body: "noop" }), null);
    assert.equal(await store.delete("missing-memo"), false);
  });
});

test("sqlite memo store persists create, update, and delete across instances", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));
  const firstStore = createMemoSqliteStore({ userDataPath });

  try {
    const created = await firstStore.create({
      title: "Call notes",
      body: "Need to send a short follow-up."
    });
    const updated = await firstStore.update(created.id, {
      body: "Need to send a short follow-up today."
    });

    assert.equal(updated?.body, "Need to send a short follow-up today.");
    firstStore.close();

    const reloadedStore = createMemoSqliteStore({ userDataPath });
    const listed = await reloadedStore.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
    assert.equal(listed[0]?.title, "Call notes");
    assert.equal(listed[0]?.body, "Need to send a short follow-up today.");

    const removed = await reloadedStore.delete(created.id);
    const remaining = await reloadedStore.list();

    assert.equal(removed, true);
    assert.equal(remaining.length, 0);
    reloadedStore.close();
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("sqlite memo store trims titles but keeps body formatting intact", async () => {
  await withTempSqliteStore(async (store) => {
    const created = await store.create({
      title: "  Weekly sync  ",
      body: "Line one\n  Line two"
    });

    assert.equal(created.title, "Weekly sync");
    assert.equal(created.body, "Line one\n  Line two");
  });
});

test("sqlite memo store migrates existing memos.json data on first run", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));

  try {
    await writeFile(
      join(userDataPath, "memos.json"),
      JSON.stringify(
        {
          version: 1,
          memos: [
            {
              id: "memo-json-1",
              title: "Migrated from memos",
              body: "This memo came from memos.json",
              createdAt: "2026-01-01T09:00:00.000Z",
              updatedAt: "2026-01-01T10:00:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const store = createMemoSqliteStore({ userDataPath });
    const listed = await store.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, "memo-json-1");
    assert.equal(listed[0]?.title, "Migrated from memos");
    store.close();
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("sqlite memo store migrates legacy notes.json data when memos.json is missing", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));

  try {
    await writeFile(
      join(userDataPath, "notes.json"),
      JSON.stringify(
        {
          version: 1,
          notes: [
            {
              id: "memo-legacy-1",
              title: "Migrated from notes",
              body: "This memo came from notes.json",
              createdAt: "2026-01-01T09:00:00.000Z",
              updatedAt: "2026-01-01T10:00:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const store = createMemoSqliteStore({ userDataPath });
    const listed = await store.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, "memo-legacy-1");
    assert.equal(listed[0]?.title, "Migrated from notes");
    store.close();
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("sqlite memo store sorts updated memos ahead of older entries", async () => {
  await withTempSqliteStore(async (store) => {
    const first = await store.create({
      title: "Earlier memo",
      body: "First entry"
    });
    const second = await store.create({
      title: "Later memo",
      body: "Second entry"
    });

    await store.update(first.id, {
      body: "Earlier memo updated last"
    });

    const listed = await store.list();

    assert.deepEqual(
      listed.map((memo) => memo.id),
      [first.id, second.id]
    );
  });
});
