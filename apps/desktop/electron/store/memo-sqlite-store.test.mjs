import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
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
      body: "Need to send a short follow-up.",
      favorite: true
    });
    const updated = await firstStore.update(created.id, {
      body: "Need to send a short follow-up today.",
      favorite: false
    });

    assert.equal(updated?.body, "Need to send a short follow-up today.");
    assert.equal(updated?.favorite, false);
    firstStore.close();

    const reloadedStore = createMemoSqliteStore({ userDataPath });
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

test("sqlite memo store persists favorite flag updates", async () => {
  await withTempSqliteStore(async (store) => {
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

test("sqlite memo store persists custom categories without requiring a memo", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));
  const store = createMemoSqliteStore({ userDataPath });

  try {
    const createdCategory = await store.createCategory({ label: "독서" });

    assert.equal(createdCategory.id, "독서");
    assert.equal(createdCategory.label, "독서");
    assert.equal(createdCategory.builtin, false);
    store.close();

    const reloadedStore = createMemoSqliteStore({ userDataPath });
    const categories = await reloadedStore.listCategories();

    assert.equal(categories.some((category) => category.id === "idea" && category.builtin), true);
    assert.equal(categories.some((category) => category.id === "독서" && !category.builtin), true);
    reloadedStore.close();
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
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

test("sqlite memo store upgrades existing databases before creating the category index", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));
  const dbPath = join(userDataPath, "memos.db");
  const legacyDb = new Database(dbPath);

  try {
    legacyDb.exec(`
      CREATE TABLE memos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO memos (id, title, body, favorite, created_at, updated_at)
      VALUES ('memo-without-category', 'Old memo', 'Created before categories', 0, '2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z');
    `);
  } finally {
    legacyDb.close();
  }

  try {
    const store = createMemoSqliteStore({ userDataPath });
    const listed = await store.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.category, null);

    const updated = await store.update("memo-without-category", { category: "idea" });

    assert.equal(updated?.category, "idea");
    store.close();

    const verificationDb = new Database(dbPath);

    try {
      const columns = verificationDb.prepare("PRAGMA table_info(memos)").all();
      const indexes = verificationDb.prepare("PRAGMA index_list(memos)").all();
      const row = verificationDb.prepare("SELECT category FROM memos WHERE id = ?").get("memo-without-category");

      assert.equal(columns.some((column) => column.name === "category"), true);
      assert.equal(indexes.some((index) => index.name === "idx_memos_category"), true);
      assert.equal(row?.category, "idea");
    } finally {
      verificationDb.close();
    }
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("sqlite memo store merges newer JSON fallback changes into an existing database", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-memo-sqlite-store-"));
  const dbPath = join(userDataPath, "memos.db");
  const jsonPath = join(userDataPath, "memos.json");
  const legacyDb = new Database(dbPath);

  try {
    legacyDb.exec(`
      CREATE TABLE app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE memos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO memos (id, title, body, favorite, created_at, updated_at)
      VALUES ('shared-memo', 'Shared memo', 'Existing SQLite body', 0, '2026-01-01T09:00:00.000Z', '2026-01-01T10:00:00.000Z');
    `);
    legacyDb
      .prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
      .run("legacy_import_source", jsonPath);
    legacyDb
      .prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)")
      .run("legacy_imported_at", "2026-01-01T10:00:00.000Z");
  } finally {
    legacyDb.close();
  }

  try {
    await writeFile(
      jsonPath,
      JSON.stringify(
        {
          version: 1,
          memos: [
            {
              id: "shared-memo",
              title: "Shared memo",
              body: "Existing SQLite body",
              favorite: true,
              category: "idea",
              createdAt: "2026-01-01T09:00:00.000Z",
              updatedAt: "2026-01-01T10:00:00.000Z"
            },
            {
              id: "json-fallback-memo",
              title: "Saved while SQLite was unavailable",
              body: "This memo only existed in memos.json.",
              favorite: false,
              category: "task",
              createdAt: "2026-01-02T09:00:00.000Z",
              updatedAt: "2026-01-02T10:00:00.000Z"
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
    const sharedMemo = listed.find((memo) => memo.id === "shared-memo");
    const fallbackMemo = listed.find((memo) => memo.id === "json-fallback-memo");

    assert.equal(listed.length, 2);
    assert.equal(sharedMemo?.category, "idea");
    assert.equal(sharedMemo?.favorite, true);
    assert.equal(fallbackMemo?.category, "task");
    assert.equal(fallbackMemo?.title, "Saved while SQLite was unavailable");
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

test("sqlite memo store replace inserts a memo with the given id and timestamps", async () => {
  await withTempSqliteStore(async (store) => {
    const memo = await store.replace({
      id: "memo-1",
      title: "원격 메모",
      body: "서버에서 받아온 내용",
      favorite: true,
      category: null,
      color: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    });

    assert.equal(memo.id, "memo-1");

    const stored = await store.get("memo-1");
    assert.equal(stored.title, "원격 메모");
    assert.equal(stored.updatedAt, "2026-01-02T00:00:00.000Z");
  });
});

test("sqlite memo store replace overwrites an existing memo with the same id", async () => {
  await withTempSqliteStore(async (store) => {
    const memo = await store.create({ title: "로컬 메모", body: "로컬 내용" });

    await store.replace({
      ...memo,
      title: "서버 메모",
      body: "서버 내용",
      updatedAt: "2026-01-03T00:00:00.000Z"
    });

    const stored = await store.get(memo.id);
    assert.equal(stored.title, "서버 메모");
    assert.equal(stored.body, "서버 내용");

    const listed = await store.list();
    assert.equal(listed.length, 1);
  });
});
