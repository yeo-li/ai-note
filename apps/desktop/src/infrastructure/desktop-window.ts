import type { MemoId } from "@ai-note/shared/memo";

/**
 * Electron desktopAPI(창 제어, 플랫폼 정보)에 대한 단일 접점.
 */
export function isMacOSPlatform(): boolean {
  return (
    window.desktopAPI?.platform === "darwin" ||
    (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  );
}

export function canOpenStickyNoteWindow() {
  return Boolean(window.desktopAPI?.window?.openStickyNote);
}

export async function openStickyNoteWindow(noteId: MemoId | null): Promise<boolean> {
  const openStickyNote = window.desktopAPI?.window?.openStickyNote;

  if (!openStickyNote) {
    throw new Error("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있어요.");
  }

  return openStickyNote(noteId);
}

export function canSetStickyPinned() {
  return Boolean(window.desktopAPI?.window?.setStickyPinned);
}

export async function setStickyPinned(pinned: boolean): Promise<boolean> {
  const setPinned = window.desktopAPI?.window?.setStickyPinned;

  if (!setPinned) {
    throw new Error("고정 기능을 사용할 수 없는 환경이다.");
  }

  return setPinned(pinned);
}

export function canOpenQuickCaptureWindow() {
  return Boolean(window.desktopAPI?.window?.openQuickCapture);
}

export async function openQuickCaptureWindow(): Promise<boolean> {
  const openQuickCapture = window.desktopAPI?.window?.openQuickCapture;

  if (!openQuickCapture) {
    throw new Error("빠른 메모는 데스크톱 앱에서만 사용할 수 있어요.");
  }

  return openQuickCapture();
}

export async function closeQuickCaptureWindow(): Promise<void> {
  const closeQuickCapture = window.desktopAPI?.window?.closeQuickCapture;

  if (!closeQuickCapture) {
    return;
  }

  await closeQuickCapture();
}
