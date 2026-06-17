import { normalizeMemoCheckboxSyntax } from "@ai-note/shared/memo";
import type { Memo, MemoCategory, MemoId, MemoStickyColor, MemoUpdateInput } from "@ai-note/shared/memo";
import { buildMemoTitleFromBody } from "../note-content";
import type { SidebarView } from "./workspace";

export type TransformMode = "default" | "organized";

export type Note = {
  id: MemoId;
  body: string;
  favorite: boolean;
  category: MemoCategory | null;
  color: MemoStickyColor | null;
  updatedAt: string;
  dateLabel: string;
  mode: TransformMode;
};

export type NoteBackup = {
  body: string;
  mode: TransformMode;
};

export type FindMatch = {
  start: number;
  end: number;
};

export function matchesQuery(note: Note, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [note.body, note.dateLabel, note.updatedAt]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function nowStamp() {
  const now = new Date();

  return {
    updatedAt: now.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit"
    }),
    dateLabel: `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`
  };
}

export function createNote(): Note {
  return {
    id: `note-${Date.now()}`,
    body: "",
    favorite: false,
    category: null,
    color: null,
    mode: "default",
    ...nowStamp()
  };
}

export function formatDateLabelFromIso(iso: string) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return nowStamp().dateLabel;
  }

  return `${parsed.getFullYear()}. ${parsed.getMonth() + 1}. ${parsed.getDate()}.`;
}

export function formatUpdatedAtFromIso(iso: string) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return nowStamp().updatedAt;
  }

  return parsed.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  });
}

export function toNoteFromMemo(memo: Memo, mode: TransformMode = "default"): Note {
  const body = normalizeMemoCheckboxSyntax(memo.body);

  return {
    id: memo.id,
    body,
    favorite: memo.favorite ?? false,
    category: memo.category ?? null,
    color: memo.color ?? null,
    updatedAt: formatUpdatedAtFromIso(memo.updatedAt),
    dateLabel: formatDateLabelFromIso(memo.updatedAt),
    mode
  };
}

export function upsertSyncedNote(currentNotes: Note[], memo: Memo) {
  const incomingNote = toNoteFromMemo(memo);
  const existingNote = currentNotes.find((note) => note.id === incomingNote.id);
  const mergedNote = existingNote
    ? {
        ...existingNote,
        body: incomingNote.body,
        favorite: incomingNote.favorite,
        category: incomingNote.category,
        color: incomingNote.color,
        updatedAt: incomingNote.updatedAt,
        dateLabel: incomingNote.dateLabel
      }
    : incomingNote;

  return [mergedNote, ...currentNotes.filter((note) => note.id !== mergedNote.id)];
}

export function removeSyncedNote(currentNotes: Note[], memoId: MemoId) {
  return currentNotes.filter((note) => note.id !== memoId);
}

export function toMemoUpdateInput(update: Partial<Note>): MemoUpdateInput {
  const patch: MemoUpdateInput = {};

  if (typeof update.body === "string") {
    const body = normalizeMemoCheckboxSyntax(update.body);
    patch.body = body;
    // 저장소/검색 계층과의 호환성을 위해 title은 본문 첫 줄에서 파생한다.
    patch.title = buildMemoTitleFromBody(body);
  }

  if (typeof update.favorite === "boolean") {
    patch.favorite = update.favorite;
  }

  if (typeof update.category !== "undefined") {
    patch.category = update.category;
  }

  if (typeof update.color !== "undefined") {
    patch.color = update.color;
  }

  return patch;
}

export function resolveSelectedNoteId(params: {
  notes: Note[];
  scopedNotes: Note[];
  selectedNote: Note | null | undefined;
  selectedNoteId: string;
  sidebarView: SidebarView;
}): string {
  if (params.notes.length === 0) return "";
  if (params.sidebarView === "favorites") return resolveFavoriteSelectedNoteId(params);
  return resolveAllSelectedNoteId(params);
}

function resolveFavoriteSelectedNoteId(params: { scopedNotes: Note[]; selectedNoteId: string }) {
  if (params.scopedNotes.length === 0) return params.selectedNoteId;
  return params.scopedNotes.some((note) => note.id === params.selectedNoteId) ? params.selectedNoteId : params.scopedNotes[0].id;
}

function resolveAllSelectedNoteId(params: { notes: Note[]; scopedNotes: Note[]; selectedNote: Note | null | undefined; selectedNoteId: string }) {
  if (params.scopedNotes.length > 0 && !params.scopedNotes.some((note) => note.id === params.selectedNoteId)) {
    return params.scopedNotes[0].id;
  }

  return params.selectedNote ? params.selectedNoteId : params.notes[0].id;
}

type DeleteSelectionParams = {
  notes: Note[];
  currentVisibleNotes: Note[];
  deleteTargetNoteId: MemoId;
  selectedNoteId: string;
  sidebarView: SidebarView;
  hasQuery: boolean;
  query: string;
};
type DeleteSelectionResult = { nextNotes: Note[]; nextSelectedNoteId: string };

export function computeNextSelectionAfterDelete(params: DeleteSelectionParams): DeleteSelectionResult | null {
  const deleteIndexes = getDeleteIndexes(params);
  if (!deleteIndexes) return null;

  const nextNotes = params.notes.filter((note) => note.id !== params.deleteTargetNoteId);
  const visibleNotes = getVisibleNotesAfterDelete(params, nextNotes);
  const fallbackSelected = getFallbackSelectedNote(nextNotes, visibleNotes, deleteIndexes);
  const nextSelected = resolveNextSelectedAfterDelete(params, nextNotes, fallbackSelected);

  return { nextNotes, nextSelectedNoteId: nextSelected?.id ?? "" };
}

type DeleteIndexes = { deletedIndex: number; deletedVisibleIndex: number };

function getDeleteIndexes(params: DeleteSelectionParams): DeleteIndexes | null {
  const deletedIndex = params.notes.findIndex((note) => note.id === params.deleteTargetNoteId);
  if (deletedIndex < 0) return null;
  return { deletedIndex, deletedVisibleIndex: params.currentVisibleNotes.findIndex((note) => note.id === params.deleteTargetNoteId) };
}

function getVisibleNotesAfterDelete(params: DeleteSelectionParams, nextNotes: Note[]) {
  const nextVisibleNotes = params.currentVisibleNotes.filter((note) => note.id !== params.deleteTargetNoteId && nextNotes.some((nextNote) => nextNote.id === note.id));

  if (params.hasQuery || params.sidebarView === "favorites" || params.currentVisibleNotes.length !== params.notes.length) {
    return nextVisibleNotes;
  }

  return nextNotes;
}

function getFallbackSelectedNote(nextNotes: Note[], visibleNotes: Note[], indexes: DeleteIndexes) {
  return visibleNotes[getBoundedIndex(indexes.deletedVisibleIndex, visibleNotes.length)] ?? nextNotes[getBoundedIndex(indexes.deletedIndex, nextNotes.length)] ?? null;
}

function getBoundedIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0));
}

function resolveNextSelectedAfterDelete(params: DeleteSelectionParams, nextNotes: Note[], fallbackSelected: Note | null) {
  if (!shouldKeepSelectionAfterDelete(params)) return fallbackSelected;
  return nextNotes.find((note) => note.id === params.selectedNoteId) ?? fallbackSelected;
}

function shouldKeepSelectionAfterDelete(params: DeleteSelectionParams) {
  return params.selectedNoteId.length > 0 && params.selectedNoteId !== params.deleteTargetNoteId;
}

export function findMatchesInBody(body: string, query: string): FindMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return collectBodyMatches(body.toLocaleLowerCase(), normalizedQuery);
}

function collectBodyMatches(normalizedBody: string, normalizedQuery: string) {
  const matches: FindMatch[] = [];
  let searchIndex = 0;

  while (searchIndex < normalizedBody.length) {
    searchIndex = appendNextBodyMatch(matches, normalizedBody, normalizedQuery, searchIndex);
    if (searchIndex < 0) break;
  }

  return matches;
}

function appendNextBodyMatch(matches: FindMatch[], normalizedBody: string, normalizedQuery: string, searchIndex: number) {
  const matchIndex = normalizedBody.indexOf(normalizedQuery, searchIndex);
  if (matchIndex === -1) return -1;
  matches.push({ start: matchIndex, end: matchIndex + normalizedQuery.length });
  return matchIndex + normalizedQuery.length;
}
