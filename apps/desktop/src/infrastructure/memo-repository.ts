import type {
  Memo,
  MemoChangeEvent,
  MemoCreateInput,
  MemoId,
  MemoOrganizeInput,
  MemoOrganizeResult,
  MemoUpdateInput
} from "@ai-note/shared/memo";
import type { MemoStoreHealth } from "../shared/memo-bridge";
import type { ContextSearchResult } from "../domain/search";

type ComposeInput = {
  prompt: string;
  intent: "polish" | "polite";
};

type ComposeResult = Awaited<ReturnType<NonNullable<Window["memoAPI"]>["compose"]>>;

/**
 * 메모 저장소(Electron memoAPI)에 대한 단일 접점.
 * 브리지가 없는 환경(브라우저 미리보기 등)에서는 호출부가 isMemoRepositoryAvailable()로 먼저 분기한다.
 */
export function isMemoRepositoryAvailable() {
  return Boolean(window.memoAPI);
}

export async function getMemoStoreHealth(): Promise<MemoStoreHealth> {
  if (!window.memoAPI) {
    return createUnavailableStoreHealth();
  }

  if (typeof window.memoAPI.health !== "function") {
    return createMissingHealthHandlerState();
  }

  return window.memoAPI.health();
}

function createUnavailableStoreHealth(): MemoStoreHealth {
  return { bridgeConnected: false, ready: false, storeKind: "memory", errorMessage: "memoAPI 브리지를 찾지 못했어요." };
}

function createMissingHealthHandlerState(): MemoStoreHealth {
  return { bridgeConnected: true, ready: false, storeKind: "memory", errorMessage: "memoAPI.health 핸들러를 찾지 못했어요." };
}

export async function listMemos(): Promise<Memo[]> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.list();
}

export async function createMemo(input: MemoCreateInput): Promise<Memo> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.create(input);
}

export async function updateMemo(memoId: MemoId, patch: MemoUpdateInput): Promise<Memo | null> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.update(memoId, patch);
}

export async function deleteMemo(memoId: MemoId): Promise<boolean> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.delete(memoId);
}

export async function searchMemosByContext(query: string): Promise<ContextSearchResult[]> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.aiSearch(query);
}

export async function getOrganizingMemoIds(): Promise<MemoId[]> {
  if (!window.memoAPI || typeof window.memoAPI.organizeState !== "function") {
    return [];
  }

  const memoIds = await window.memoAPI.organizeState();
  return Array.isArray(memoIds) ? memoIds : [];
}

export async function organizeMemo(input: MemoOrganizeInput): Promise<MemoOrganizeResult> {
  if (!window.memoAPI) {
    throw new Error("memoAPI 브리지를 찾지 못했어요.");
  }

  return window.memoAPI.organize(input);
}

export async function composeMemo(input: ComposeInput): Promise<ComposeResult> {
  if (!window.memoAPI) {
    throw new Error("메모 조합 API를 찾지 못했어요.");
  }

  return window.memoAPI.compose(input);
}

export function subscribeToMemoChanges(listener: (event: MemoChangeEvent) => void) {
  if (!window.memoAPI?.onDidChange) {
    return () => {};
  }

  return window.memoAPI.onDidChange(listener);
}

export function subscribeToOrganizeState(listener: (event: { memoId: MemoId; busy: boolean }) => void) {
  if (!window.memoAPI?.onDidOrganizeState) {
    return undefined;
  }

  return window.memoAPI.onDidOrganizeState(listener);
}
