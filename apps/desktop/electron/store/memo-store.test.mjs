import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMemoStore } from "./memo-store.mjs";

async function withTempStore(run) {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-store-"));

  try {
    return await run(createMemoStore({ userDataPath }));
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
}

test("memo store starts empty without persisted data", async () => {
  await withTempStore(async (store) => {
    const memos = await store.list();

    assert.deepEqual(memos, []);
    assert.equal(await store.get("missing-memo"), null);
    assert.equal(await store.update("missing-memo", { body: "noop" }), null);
    assert.equal(await store.delete("missing-memo"), false);
  });
});

test("memo store persists create, update, and delete across instances", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-store-"));

  try {
    const store = createMemoStore({ userDataPath });
    const created = await store.create({
      title: "Call notes",
      body: "Need to send a short follow-up.",
      favorite: true
    });
    const updated = await store.update(created.id, {
      body: "Need to send a short follow-up today.",
      favorite: false
    });

    assert.equal(updated?.body, "Need to send a short follow-up today.");
    assert.equal(updated?.favorite, false);

    const reloadedStore = createMemoStore({ userDataPath });
    const listed = await reloadedStore.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
    assert.equal(listed[0]?.title, "Call notes");
    assert.equal(listed[0]?.body, "Need to send a short follow-up today.");
    assert.equal(listed[0]?.favorite, false);

    const removed = await reloadedStore.delete(created.id);
    const remaining = await reloadedStore.list();

    assert.equal(removed, true);
    assert.equal(remaining.length, 0);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("memo store trims titles but keeps body formatting intact", async () => {
  await withTempStore(async (store) => {
    const created = await store.create({
      title: "  Weekly sync  ",
      body: "Line one\n  Line two"
    });

    assert.equal(created.title, "Weekly sync");
    assert.equal(created.body, "Line one\n  Line two");
  });
});

test("memo store persists favorite flag updates", async () => {
  await withTempStore(async (store) => {
    const created = await store.create({
      title: "Starred memo",
      body: "Remember this",
      favorite: false
    });

    const updated = await store.update(created.id, { favorite: true });

    assert.equal(updated?.favorite, true);
    assert.equal((await store.get(created.id))?.favorite, true);
  });
});

test("memo store preserves the last concurrent update", async () => {
  await withTempStore(async (store) => {
    const created = await store.create({
      title: "Draft",
      body: "v1"
    });

    const firstUpdate = store.update(created.id, {
      body: "v2"
    });
    const secondUpdate = store.update(created.id, {
      body: "v3"
    });

    const [, lastResolved] = await Promise.all([firstUpdate, secondUpdate]);
    const reloaded = await store.get(created.id);

    assert.equal(lastResolved?.body, "v3");
    assert.equal(reloaded?.body, "v3");
  });
});

test("memo store reads legacy notes.json data and migrates on write", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-store-"));
  const legacyFilePath = join(userDataPath, "notes.json");
  const legacyMemo = {
    id: "legacy-note-1",
    title: "Legacy note",
    body: "Stored before the memo rename.",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z"
  };

  try {
    await writeFile(
      legacyFilePath,
      JSON.stringify(
        {
          version: 1,
          notes: [legacyMemo]
        },
        null,
        2
      ),
      "utf8"
    );

    const store = createMemoStore({ userDataPath });
    const listed = await store.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, legacyMemo.id);
    assert.equal(listed[0]?.body, legacyMemo.body);

    await store.create({
      title: "New memo",
      body: "Created after migration."
    });

    const migratedPayload = JSON.parse(await readFile(join(userDataPath, "memos.json"), "utf8"));

    assert.equal(Array.isArray(migratedPayload.memos), true);
    assert.equal(migratedPayload.memos.length, 2);
    assert.equal(migratedPayload.memos.some((memo) => memo.id === legacyMemo.id), true);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("memo store backs up corrupt memos.json and starts empty", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-store-"));
  const memoFilePath = join(userDataPath, "memos.json");

  try {
    await writeFile(memoFilePath, "{not-json", "utf8");

    const store = createMemoStore({ userDataPath });
    const listed = await store.list();
    const backupFiles = await readdir(userDataPath);

    assert.deepEqual(listed, []);
    assert.equal(backupFiles.some((fileName) => fileName.startsWith("memos.json.corrupt-")), true);

    const created = await store.create({
      title: "Recovered memo",
      body: "Created after corrupt JSON backup."
    });
    const persistedPayload = JSON.parse(await readFile(memoFilePath, "utf8"));

    assert.equal(persistedPayload.memos.length, 1);
    assert.equal(persistedPayload.memos[0]?.id, created.id);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("memo store falls back to legacy notes.json when memos.json is corrupt", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-store-"));
  const memoFilePath = join(userDataPath, "memos.json");
  const legacyFilePath = join(userDataPath, "notes.json");
  const legacyMemo = {
    id: "legacy-after-corrupt-json",
    title: "Legacy backup",
    body: "Use this when memos.json cannot be parsed.",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z"
  };

  try {
    await writeFile(memoFilePath, "{not-json", "utf8");
    await writeFile(
      legacyFilePath,
      JSON.stringify(
        {
          version: 1,
          notes: [legacyMemo]
        },
        null,
        2
      ),
      "utf8"
    );

    const store = createMemoStore({ userDataPath });
    const listed = await store.list();
    const backupFiles = await readdir(userDataPath);

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, legacyMemo.id);
    assert.equal(backupFiles.some((fileName) => fileName.startsWith("memos.json.corrupt-")), true);

    await store.create({
      title: "New memo",
      body: "Created after fallback."
    });

    const migratedPayload = JSON.parse(await readFile(memoFilePath, "utf8"));

    assert.equal(migratedPayload.memos.length, 2);
    assert.equal(migratedPayload.memos.some((memo) => memo.id === legacyMemo.id), true);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("memo store sorts updated memos ahead of older entries", async () => {
  await withTempStore(async (store) => {
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
