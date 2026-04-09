import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const NOTE_STORE_VERSION = 1;
const NOTE_STORE_FILENAME = "notes.json";

function normalizeTimestamp(value) {
  return typeof value === "string" && value.length > 0 ? value : new Date().toISOString();
}

function normalizeNote(note) {
  const createdAt = normalizeTimestamp(note.createdAt);
  const updatedAt = normalizeTimestamp(note.updatedAt);

  return {
    id: typeof note.id === "string" && note.id.length > 0 ? note.id : randomUUID(),
    title: typeof note.title === "string" ? note.title : "",
    body: typeof note.body === "string" ? note.body : "",
    createdAt,
    updatedAt
  };
}

function sortNotesByUpdatedAt(notes) {
  return [...notes].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function ensureParentDirectory(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function readStore(filePath) {
  try {
    const fileContents = await readFile(filePath, "utf8");
    const parsed = JSON.parse(fileContents);
    const notes = Array.isArray(parsed.notes) ? parsed.notes.map(normalizeNote) : [];

    return {
      version: NOTE_STORE_VERSION,
      notes: sortNotesByUpdatedAt(notes)
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        version: NOTE_STORE_VERSION,
        notes: []
      };
    }

    throw error;
  }
}

async function writeStore(filePath, store) {
  const tempPath = `${filePath}.tmp`;
  const payload = JSON.stringify(
    {
      version: NOTE_STORE_VERSION,
      notes: sortNotesByUpdatedAt(store.notes)
    },
    null,
    2
  );

  await ensureParentDirectory(filePath);
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
}

export function createNoteStore({ userDataPath }) {
  const filePath = join(userDataPath, NOTE_STORE_FILENAME);

  return {
    filePath,

    async listNotes() {
      const store = await readStore(filePath);
      return store.notes;
    },

    async getNote(noteId) {
      const store = await readStore(filePath);
      return store.notes.find((note) => note.id === noteId) ?? null;
    },

    async createNote(input = {}) {
      const now = new Date().toISOString();
      const note = normalizeNote({
        id: randomUUID(),
        title: input.title ?? "",
        body: input.body ?? "",
        createdAt: now,
        updatedAt: now
      });
      const store = await readStore(filePath);

      store.notes = [note, ...store.notes.filter((existingNote) => existingNote.id !== note.id)];
      await writeStore(filePath, store);

      return note;
    },

    async updateNote(noteId, updates = {}) {
      const store = await readStore(filePath);
      const currentNote = store.notes.find((note) => note.id === noteId);

      if (!currentNote) {
        return null;
      }

      const nextNote = normalizeNote({
        ...currentNote,
        title: updates.title ?? currentNote.title,
        body: updates.body ?? currentNote.body,
        updatedAt: new Date().toISOString()
      });

      store.notes = [nextNote, ...store.notes.filter((note) => note.id !== noteId)];
      await writeStore(filePath, store);

      return nextNote;
    },

    async deleteNote(noteId) {
      const store = await readStore(filePath);
      const nextNotes = store.notes.filter((note) => note.id !== noteId);

      if (nextNotes.length === store.notes.length) {
        return false;
      }

      store.notes = nextNotes;
      await writeStore(filePath, store);

      return true;
    }
  };
}
