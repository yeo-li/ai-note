import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import {
  LEGACY_NOTE_STORE_FILENAME,
  MEMO_SQLITE_FILENAME,
  MEMO_STORE_FILENAME,
  cloneMemo,
  createTimestampAfter,
  normalizeMemo,
  parseStorePayload,
  sortMemosByUpdatedAt
} from "./memo-store-model.mjs";

function openDatabase(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return db;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memos_updated_at
      ON memos(updated_at DESC, created_at DESC);
  `);

  db.prepare(
    `
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, @appliedAt)
    `
  ).run({
    appliedAt: new Date().toISOString()
  });

  const memoColumns = db.prepare("PRAGMA table_info(memos)").all();
  const hasFavoriteColumn = memoColumns.some((column) => column.name === "favorite");

  if (!hasFavoriteColumn) {
    db.exec("ALTER TABLE memos ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;");
  }
}

function rowToMemo(row) {
  if (!row) {
    return null;
  }

  return normalizeMemo({
    id: row.id,
    title: row.title,
    body: row.body,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function readLegacyStoreSync(userDataPath) {
  const memoStorePath = join(userDataPath, MEMO_STORE_FILENAME);
  const legacyStorePath = join(userDataPath, LEGACY_NOTE_STORE_FILENAME);
  const candidates = [memoStorePath, legacyStorePath];

  for (const candidatePath of candidates) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    const payload = readFileSync(candidatePath, "utf8");
    return {
      sourcePath: candidatePath,
      store: parseStorePayload(JSON.parse(payload))
    };
  }

  return {
    sourcePath: null,
    store: {
      version: 1,
      memos: []
    }
  };
}

function migrateLegacyStoreIfNeeded(db, userDataPath) {
  const existingCount = db.prepare("SELECT COUNT(*) AS count FROM memos").get().count;

  if (existingCount > 0 || !userDataPath) {
    return;
  }

  const { sourcePath, store } = readLegacyStoreSync(userDataPath);

  if (!sourcePath || store.memos.length === 0) {
    return;
  }

  const insertMemoStatement = db.prepare(
    `
      INSERT OR REPLACE INTO memos (id, title, body, favorite, created_at, updated_at)
      VALUES (@id, @title, @body, @favorite, @createdAt, @updatedAt)
    `
  );
  const upsertMetadataStatement = db.prepare(
    `
      INSERT OR REPLACE INTO app_metadata (key, value)
      VALUES (@key, @value)
    `
  );
  const insertMany = db.transaction((memos) => {
    for (const memo of sortMemosByUpdatedAt(memos)) {
      const normalized = normalizeMemo(memo);

      insertMemoStatement.run({
        id: normalized.id || randomUUID(),
        title: normalized.title,
        body: normalized.body,
        favorite: normalized.favorite ? 1 : 0,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt
      });
    }
  });

  insertMany(store.memos);
  upsertMetadataStatement.run({
    key: "legacy_import_source",
    value: sourcePath
  });
  upsertMetadataStatement.run({
    key: "legacy_imported_at",
    value: new Date().toISOString()
  });
}

function createStatements(db) {
  return {
    list: db.prepare(
      `
        SELECT id, title, body, created_at, updated_at
               , favorite
        FROM memos
        ORDER BY updated_at DESC, created_at DESC
      `
    ),
    get: db.prepare(
      `
        SELECT id, title, body, created_at, updated_at
               , favorite
        FROM memos
        WHERE id = @id
        LIMIT 1
      `
    ),
    insert: db.prepare(
      `
        INSERT INTO memos (id, title, body, favorite, created_at, updated_at)
        VALUES (@id, @title, @body, @favorite, @createdAt, @updatedAt)
      `
    ),
    update: db.prepare(
      `
        UPDATE memos
        SET title = @title,
            body = @body,
            favorite = @favorite,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    delete: db.prepare(
      `
        DELETE FROM memos
        WHERE id = @id
      `
    ),
    getLatestUpdatedAt: db.prepare(
      `
        SELECT MAX(updated_at) AS updated_at
        FROM memos
      `
    )
  };
}

export function createMemoSqliteStore({ userDataPath, dbPath } = {}) {
  if (!dbPath && !userDataPath) {
    throw new Error("createMemoSqliteStore requires either userDataPath or dbPath.");
  }

  const filePath = dbPath ?? join(userDataPath, MEMO_SQLITE_FILENAME);
  const db = openDatabase(filePath);

  ensureSchema(db);
  migrateLegacyStoreIfNeeded(db, userDataPath);
  const statements = createStatements(db);

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
    close() {
      if (db.open) {
        db.close();
      }
    },

    async list() {
      return runSerialized(async () => {
        return statements.list.all().map((row) => cloneMemo(rowToMemo(row)));
      });
    },

    async get(memoId) {
      return runSerialized(async () => {
        const memo = rowToMemo(statements.get.get({ id: memoId }));
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

        statements.insert.run({
          id: memo.id,
          title: memo.title,
          body: memo.body,
          favorite: memo.favorite ? 1 : 0,
          createdAt: memo.createdAt,
          updatedAt: memo.updatedAt
        });

        return cloneMemo(memo);
      });
    },

    async update(memoId, updates = {}) {
      return runSerialized(async () => {
        const currentMemo = rowToMemo(statements.get.get({ id: memoId }));

        if (!currentMemo) {
          return null;
        }

        const shouldRefreshTimestamp = typeof updates.title === "string" || typeof updates.body === "string";
        const latestUpdatedAt = statements.getLatestUpdatedAt.get()?.updated_at;

        const nextMemo = normalizeMemo({
          ...currentMemo,
          title: updates.title ?? currentMemo.title,
          body: updates.body ?? currentMemo.body,
          favorite: typeof updates.favorite === "boolean" ? updates.favorite : currentMemo.favorite,
          updatedAt: shouldRefreshTimestamp ? createTimestampAfter([currentMemo.updatedAt, latestUpdatedAt]) : currentMemo.updatedAt
        });

        statements.update.run({
          id: memoId,
          title: nextMemo.title,
          body: nextMemo.body,
          favorite: nextMemo.favorite ? 1 : 0,
          updatedAt: nextMemo.updatedAt
        });

        return cloneMemo(nextMemo);
      });
    },

    async delete(memoId) {
      return runSerialized(async () => {
        const result = statements.delete.run({ id: memoId });
        return result.changes > 0;
      });
    }
  };
}
