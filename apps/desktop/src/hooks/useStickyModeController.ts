import type { Dispatch, SetStateAction } from "react";
import {
  canOpenStickyNoteWindow,
  canSetStickyPinned,
  openStickyNoteWindow,
  setStickyPinned
} from "../infrastructure/desktop-window";
import type { Note } from "../domain/note";

type UseStickyModeControllerParams = {
  activeNote: Note | null;
  isDedicatedStickyWindow: boolean;
  isStickyPinned: boolean;
  setIsStickyMode: Dispatch<SetStateAction<boolean>>;
  setIsStickyPinned: Dispatch<SetStateAction<boolean>>;
  setStatusMessage: (message: string) => void;
};

export function useStickyModeController(params: UseStickyModeControllerParams) {
  return {
    closeStickySurface: () => closeStickySurface(params),
    handleOpenStickyNoteWindow: () => handleOpenStickyNoteWindow(params),
    toggleStickyPinned: () => toggleStickyPinned(params)
  };
}

async function handleOpenStickyNoteWindow(params: UseStickyModeControllerParams) {
  if (!canOpenStickyNoteWindow()) {
    params.setStatusMessage("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있어요.");
    return;
  }

  try {
    await openStickyNoteWindow(params.activeNote?.id ?? null);
    params.setStatusMessage("새 스티커 메모 창을 열어두었어요.");
  } catch {
    params.setStatusMessage("스티커 메모 창을 열지 못했어요.");
  }
}

async function toggleStickyPinned(params: UseStickyModeControllerParams) {
  if (!canToggleStickyPinned(params)) return;

  try {
    const pinned = await setStickyPinned(!params.isStickyPinned);
    params.setIsStickyPinned(pinned);
    params.setStatusMessage(pinned ? "스티커 메모를 화면 맨 위에 고정했어요." : "스티커 메모 고정을 해제했어요.");
  } catch {
    params.setStatusMessage("스티커 메모 고정 상태를 바꾸지 못했어요.");
  }
}

function closeStickySurface(params: UseStickyModeControllerParams) {
  if (params.isDedicatedStickyWindow) {
    window.close();
    return;
  }

  params.setIsStickyMode(false);
  params.setStatusMessage("일반 모드로 돌아왔다.");
}

function canToggleStickyPinned(params: UseStickyModeControllerParams) {
  if (!params.isDedicatedStickyWindow) {
    params.setStatusMessage("스티커 창에서만 고정 기능을 사용할 수 있어요.");
    return false;
  }

  if (!canSetStickyPinned()) {
    params.setStatusMessage("고정 기능을 사용할 수 없는 환경이다.");
    return false;
  }

  return true;
}
