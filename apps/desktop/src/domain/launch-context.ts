import type { MemoId } from "@ai-note/shared/memo";

export type LaunchContext = {
  stickyMode: boolean;
  requestedNoteId: MemoId | null;
};

export function readLaunchContext(): LaunchContext {
  if (typeof window === "undefined") {
    return createDefaultLaunchContext();
  }

  const query = new URLSearchParams(window.location.search);
  return createLaunchContextFromQuery(query);
}

function createDefaultLaunchContext(): LaunchContext {
  return { stickyMode: false, requestedNoteId: null };
}

function createLaunchContextFromQuery(query: URLSearchParams): LaunchContext {
  return {
    stickyMode: query.get("view") === "sticky",
    requestedNoteId: readRequestedNoteId(query)
  };
}

function readRequestedNoteId(query: URLSearchParams) {
  const requestedNoteId = query.get("noteId");
  return requestedNoteId && requestedNoteId.trim().length > 0 ? requestedNoteId.trim() : null;
}
