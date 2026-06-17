import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import {
  LEGACY_NOTE_STORE_FILENAME,
  MEMO_SQLITE_FILENAME,
  MEMO_STORE_FILENAME,
  DEFAULT_CATEGORY_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS memo_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0,
      category TEXT DEFAULT NULL,
      color TEXT DEFAULT NULL,
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
  const hasCategoryColumn = memoColumns.some((column) => column.name === "category");
  const hasColorColumn = memoColumns.some((column) => column.name === "color");

  if (!hasFavoriteColumn) {
    db.exec("ALTER TABLE memos ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasCategoryColumn) {
    db.exec("ALTER TABLE memos ADD COLUMN category TEXT DEFAULT NULL;");
  }

  if (!hasColorColumn) {
    db.exec("ALTER TABLE memos ADD COLUMN color TEXT DEFAULT NULL;");
  }

  const categoryColumns = db.prepare("PRAGMA table_info(memo_categories)").all();
  const hasDescriptionColumn = categoryColumns.some((column) => column.name === "description");

  if (!hasDescriptionColumn) {
    db.exec("ALTER TABLE memo_categories ADD COLUMN description TEXT NOT NULL DEFAULT '';");
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_memos_category ON memos(category);");
  seedBuiltinCategories(db);
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
    category: row.category,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function rowToCategory(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? "",
    builtin: row.builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function seedBuiltinCategories(db) {
  // memo_categories가 비어 있을 때만(최초 실행) 기본 카테고리를 채운다.
  // 그렇지 않으면 사용자가 기본 카테고리를 수정/삭제한 결과가 재실행 시마다 되돌아온다.
  const existingCount = db.prepare("SELECT COUNT(*) AS count FROM memo_categories").get().count;

  if (existingCount > 0) {
    return;
  }

  const upsertCategoryStatement = createCategoryUpsertStatement(db);
  const insertBuiltins = db.transaction((categories) => {
    for (const category of categories) {
      upsertCategoryStatement.run(toCategoryRow(category));
    }
  });

  insertBuiltins(createBuiltinCategoryDefinitions());
}

function readLegacyStoreSync(userDataPath) {
  const memoStorePath = join(userDataPath, MEMO_STORE_FILENAME);
  const legacyStorePath = join(userDataPath, LEGACY_NOTE_STORE_FILENAME);
  const candidates = [memoStorePath, legacyStorePath];

  for (const candidatePath of candidates) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    try {
      const payload = readFileSync(candidatePath, "utf8");
      return {
        sourceMtimeMs: statSync(candidatePath).mtimeMs,
        sourcePath: candidatePath,
        store: parseStorePayload(JSON.parse(payload))
      };
    } catch (error) {
      console.warn(`[memo-store] Skipping unreadable legacy memo store at ${candidatePath}.`, error);
    }
  }

  return {
    sourceMtimeMs: null,
    sourcePath: null,
    store: {
      version: 1,
      memos: []
    }
  };
}

function createMemoInsertStatement(db) {
  return db.prepare(
    `
      INSERT OR REPLACE INTO memos (id, title, body, favorite, category, color, created_at, updated_at)
      VALUES (@id, @title, @body, @favorite, @category, @color, @createdAt, @updatedAt)
    `
  );
}

function createCategoryUpsertStatement(db) {
  return db.prepare(
    `
      INSERT INTO memo_categories (id, label, description, builtin, created_at, updated_at)
      VALUES (@id, @label, @description, @builtin, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        builtin = CASE WHEN memo_categories.builtin = 1 THEN 1 ELSE excluded.builtin END,
        updated_at = excluded.updated_at
    `
  );
}

function createMetadataUpsertStatement(db) {
  return db.prepare(
    `
      INSERT OR REPLACE INTO app_metadata (key, value)
      VALUES (@key, @value)
    `
  );
}

function writeMetadata(upsertMetadataStatement, key, value) {
  upsertMetadataStatement.run({
    key,
    value: String(value)
  });
}

function toCategoryRow(category) {
  return {
    id: category.id,
    label: category.label,
    description: category.description ?? "",
    builtin: category.builtin ? 1 : 0,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
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

function upsertCategories(db, categories) {
  const upsertCategoryStatement = createCategoryUpsertStatement(db);
  const insertMany = db.transaction((nextCategories) => {
    for (const category of nextCategories) {
      upsertCategoryStatement.run(toCategoryRow(category));
    }
  });

  insertMany(categories);
}

function migrateLegacyStoreIfNeeded(db, userDataPath) {
  const existingCount = db.prepare("SELECT COUNT(*) AS count FROM memos").get().count;

  if (existingCount > 0 || !userDataPath) {
    return;
  }

  const { sourceMtimeMs, sourcePath, store } = readLegacyStoreSync(userDataPath);

  if (!sourcePath || store.memos.length === 0) {
    return;
  }

  const insertMemoStatement = createMemoInsertStatement(db);
  const upsertMetadataStatement = createMetadataUpsertStatement(db);
  const insertMany = db.transaction((memos) => {
    for (const memo of sortMemosByUpdatedAt(memos)) {
      const normalized = normalizeMemo(memo);

      insertMemoStatement.run({
        id: normalized.id || randomUUID(),
        title: normalized.title,
        body: normalized.body,
        favorite: normalized.favorite ? 1 : 0,
        category: normalized.category,
        color: normalized.color,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt
      });
    }
  });

  insertMany(store.memos);
  upsertCategories(db, mergeCategoryDefinitions(store.categories ?? [], store.memos.map(createCategoryFromMemo).filter(Boolean)));
  writeMetadata(upsertMetadataStatement, "legacy_import_source", sourcePath);
  writeMetadata(upsertMetadataStatement, "legacy_imported_at", new Date().toISOString());

  if (Number.isFinite(sourceMtimeMs)) {
    writeMetadata(upsertMetadataStatement, "legacy_synced_mtime_ms", sourceMtimeMs);
  }
}

function readMetadata(db) {
  return new Map(db.prepare("SELECT key, value FROM app_metadata").all().map((row) => [row.key, row.value]));
}

function toTimestampMs(value) {
  if (typeof value !== "string" || value.length === 0) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getLegacySyncBaselineMs(metadata) {
  const syncedMtimeMs = toFiniteNumber(metadata.get("legacy_synced_mtime_ms"));

  if (syncedMtimeMs !== null) {
    return syncedMtimeMs;
  }

  return toTimestampMs(metadata.get("legacy_imported_at"));
}

function shouldSyncLegacyStore(metadata, sourcePath, sourceMtimeMs) {
  if (!sourcePath || !Number.isFinite(sourceMtimeMs)) {
    return false;
  }

  if (metadata.get("legacy_import_source") !== sourcePath) {
    return false;
  }

  return sourceMtimeMs > getLegacySyncBaselineMs(metadata);
}

function syncLegacyStoreIfNeeded(db, userDataPath) {
  if (!userDataPath) {
    return;
  }

  const metadata = readMetadata(db);
  const { sourceMtimeMs, sourcePath, store } = readLegacyStoreSync(userDataPath);

  if (!shouldSyncLegacyStore(metadata, sourcePath, sourceMtimeMs) || store.memos.length === 0) {
    return;
  }

  const insertMemoStatement = createMemoInsertStatement(db);
  const categoriesToSync = mergeCategoryDefinitions(store.categories ?? [], store.memos.map(createCategoryFromMemo).filter(Boolean));
  const getMemoStatement = db.prepare("SELECT id, favorite, category, color, updated_at FROM memos WHERE id = @id LIMIT 1");
  const updateMemoStatement = db.prepare(
    `
      UPDATE memos
      SET title = @title,
          body = @body,
          favorite = @favorite,
          category = @category,
          color = @color,
          created_at = @createdAt,
          updated_at = @updatedAt
      WHERE id = @id
    `
  );
  const updateMemoMetadataStatement = db.prepare(
    `
      UPDATE memos
      SET favorite = @favorite,
          category = @category,
          color = @color
      WHERE id = @id
    `
  );
  const upsertMetadataStatement = createMetadataUpsertStatement(db);
  const syncMany = db.transaction((memos) => {
    for (const memo of sortMemosByUpdatedAt(memos)) {
      const normalized = normalizeMemo(memo);
      const existing = getMemoStatement.get({ id: normalized.id });

      if (!existing) {
        insertMemoStatement.run({
          id: normalized.id,
          title: normalized.title,
          body: normalized.body,
          favorite: normalized.favorite ? 1 : 0,
          category: normalized.category,
          color: normalized.color,
          createdAt: normalized.createdAt,
          updatedAt: normalized.updatedAt
        });
        continue;
      }

      const incomingUpdatedAt = toTimestampMs(normalized.updatedAt);
      const existingUpdatedAt = toTimestampMs(existing.updated_at);
      const incomingFavorite = normalized.favorite ? 1 : 0;

      if (incomingUpdatedAt > existingUpdatedAt) {
        updateMemoStatement.run({
          id: normalized.id,
          title: normalized.title,
          body: normalized.body,
          favorite: incomingFavorite,
          category: normalized.category,
          color: normalized.color,
          createdAt: normalized.createdAt,
          updatedAt: normalized.updatedAt
        });
        continue;
      }

      if (incomingUpdatedAt === existingUpdatedAt && (existing.favorite !== incomingFavorite || existing.category !== normalized.category || existing.color !== normalized.color)) {
        updateMemoMetadataStatement.run({
          id: normalized.id,
          favorite: incomingFavorite,
          category: normalized.category,
          color: normalized.color
        });
      }
    }
  });

  syncMany(store.memos);
  upsertCategories(db, categoriesToSync);
  writeMetadata(upsertMetadataStatement, "legacy_synced_mtime_ms", sourceMtimeMs);
  writeMetadata(upsertMetadataStatement, "legacy_synced_at", new Date().toISOString());
}

function createStatements(db) {
  return {
    list: db.prepare(
      `
        SELECT id, title, body, created_at, updated_at
               , favorite, category, color
        FROM memos
        ORDER BY updated_at DESC, created_at DESC
      `
    ),
    get: db.prepare(
      `
        SELECT id, title, body, created_at, updated_at
               , favorite, category, color
        FROM memos
        WHERE id = @id
        LIMIT 1
      `
    ),
    insert: db.prepare(
      `
        INSERT INTO memos (id, title, body, favorite, category, color, created_at, updated_at)
        VALUES (@id, @title, @body, @favorite, @category, @color, @createdAt, @updatedAt)
      `
    ),
    replace: db.prepare(
      `
        INSERT OR REPLACE INTO memos (id, title, body, favorite, category, color, created_at, updated_at)
        VALUES (@id, @title, @body, @favorite, @category, @color, @createdAt, @updatedAt)
      `
    ),
    update: db.prepare(
      `
        UPDATE memos
        SET title = @title,
            body = @body,
            favorite = @favorite,
            category = @category,
            color = @color,
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
    ),
    listCategories: db.prepare(
      `
        SELECT id, label, description, builtin, created_at, updated_at
        FROM memo_categories
        ORDER BY builtin DESC, label ASC
      `
    ),
    getCategory: db.prepare(
      `
        SELECT id, label, description, builtin, created_at, updated_at
        FROM memo_categories
        WHERE id = @id
        LIMIT 1
      `
    ),
    listMemoCategories: db.prepare(
      `
        SELECT DISTINCT category AS id
        FROM memos
        WHERE category IS NOT NULL
          AND category != ''
      `
    ),
    insertCategory: db.prepare(
      `
        INSERT INTO memo_categories (id, label, description, builtin, created_at, updated_at)
        VALUES (@id, @label, @description, @builtin, @createdAt, @updatedAt)
      `
    ),
    updateCategory: db.prepare(
      `
        UPDATE memo_categories
        SET label = @label,
            description = @description,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    deleteCategory: db.prepare(
      `
        DELETE FROM memo_categories
        WHERE id = @id
      `
    ),
    unassignMemoCategory: db.prepare(
      `
        UPDATE memos
        SET category = NULL
        WHERE category = @category
      `
    ),
    listMemosByCategory: db.prepare(
      `
        SELECT id, title, body, created_at, updated_at
               , favorite, category, color
        FROM memos
        WHERE category = @category
      `
    )
  };
}

function listCategoryDefinitions(statements) {
  const storedCategories = statements.listCategories.all().map(rowToCategory).filter(Boolean);
  const memoCategories = statements.listMemoCategories
    .all()
    .map((row) => ({
      id: row.id,
      label: row.id,
      builtin: false,
      createdAt: DEFAULT_CATEGORY_TIMESTAMP,
      updatedAt: DEFAULT_CATEGORY_TIMESTAMP
    }));

  const categories = mergeCategoryDefinitions(storedCategories, memoCategories);
  return categories.length > 0 ? categories : createBuiltinCategoryDefinitions();
}

export function createMemoSqliteStore({ userDataPath, dbPath } = {}) {
  if (!dbPath && !userDataPath) {
    throw new Error("createMemoSqliteStore requires either userDataPath or dbPath.");
  }

  const filePath = dbPath ?? join(userDataPath, MEMO_SQLITE_FILENAME);
  const db = openDatabase(filePath);

  let statements;

  try {
    ensureSchema(db);
    migrateLegacyStoreIfNeeded(db, userDataPath);
    syncLegacyStoreIfNeeded(db, userDataPath);
    statements = createStatements(db);
  } catch (error) {
    if (db.open) {
      db.close();
    }

    throw error;
  }

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
          category: input.category ?? null,
          color: input.color ?? null,
          createdAt: now,
          updatedAt: now
        });

        statements.insert.run({
          id: memo.id,
          title: memo.title,
          body: memo.body,
          favorite: memo.favorite ? 1 : 0,
          category: memo.category,
          color: memo.color,
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
          category: typeof updates.category !== "undefined" ? updates.category : currentMemo.category,
          color: typeof updates.color !== "undefined" ? updates.color : currentMemo.color,
          updatedAt: shouldRefreshTimestamp ? createTimestampAfter([currentMemo.updatedAt, latestUpdatedAt]) : currentMemo.updatedAt
        });

        statements.update.run({
          id: memoId,
          title: nextMemo.title,
          body: nextMemo.body,
          favorite: nextMemo.favorite ? 1 : 0,
          category: nextMemo.category,
          color: nextMemo.color,
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
    },

    async replace(memo) {
      return runSerialized(async () => {
        const normalized = normalizeMemo(memo);

        statements.replace.run({
          id: normalized.id,
          title: normalized.title,
          body: normalized.body,
          favorite: normalized.favorite ? 1 : 0,
          category: normalized.category,
          color: normalized.color,
          createdAt: normalized.createdAt,
          updatedAt: normalized.updatedAt
        });

        return cloneMemo(normalized);
      });
    },

    async listCategories() {
      return runSerialized(async () => listCategoryDefinitions(statements));
    },

    async createCategory(input = {}) {
      return runSerialized(async () => {
        const category = createCategoryDefinitionFromLabel(input.label, { description: input.description });

        if (!category) {
          throw new Error("카테고리 이름을 확인해 주세요.");
        }

        const categories = listCategoryDefinitions(statements);

        if (hasCategoryDuplicate(categories, category)) {
          throw new Error("이미 있는 카테고리입니다.");
        }

        statements.insertCategory.run(toCategoryRow(category));
        return category;
      });
    },

    async updateCategory(categoryId, patch = {}) {
      return runSerialized(async () => {
        const existingRow = statements.getCategory.get({ id: categoryId });
        const currentCategory = rowToCategory(existingRow);

        if (!currentCategory) {
          throw new Error("카테고리를 찾지 못했어요.");
        }

        const updatedCategory = {
          ...currentCategory,
          ...normalizeCategoryUpdateInput(patch),
          updatedAt: new Date().toISOString()
        };

        statements.updateCategory.run({
          id: updatedCategory.id,
          label: updatedCategory.label,
          description: updatedCategory.description,
          updatedAt: updatedCategory.updatedAt
        });
        return updatedCategory;
      });
    },

    async deleteCategory(categoryId) {
      return runSerialized(async () => {
        const existingRow = statements.getCategory.get({ id: categoryId });
        const currentCategory = rowToCategory(existingRow);

        if (!currentCategory) {
          return { category: null, updatedMemos: [] };
        }

        const affectedMemos = statements.listMemosByCategory.all({ category: categoryId }).map((row) => cloneMemo(rowToMemo(row)));

        const removeCategory = db.transaction(() => {
          statements.unassignMemoCategory.run({ category: categoryId });
          statements.deleteCategory.run({ id: categoryId });
        });

        removeCategory();

        return {
          category: currentCategory,
          updatedMemos: affectedMemos.map((memo) => ({ ...memo, category: null }))
        };
      });
    }
  };
}

function hasCategoryDuplicate(categories, candidate) {
  const normalizedLabel = candidate.label.toLocaleLowerCase("ko-KR");
  return categories.some((category) => category.id === candidate.id || category.label.toLocaleLowerCase("ko-KR") === normalizedLabel);
}
