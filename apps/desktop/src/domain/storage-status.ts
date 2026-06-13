import type { MemoStoreHealth } from "../shared/memo-bridge";

const storageKindLabels: Record<MemoStoreHealth["storeKind"], string> = {
  sqlite: "SQLite",
  json: "JSON",
  memory: "Memory"
};

export function getStorageKindLabel(kind: MemoStoreHealth["storeKind"]) {
  return storageKindLabels[kind] ?? "Memory";
}

export function getStorageStatusSummary(health: MemoStoreHealth | null) {
  if (!health) {
    return "";
  }

  if (!health.ready) {
    return "저장소 연결을 확인하지 못해서 지금은 편집을 잠가두었어요.";
  }

  if (health.fallbackReason) {
    return `SQLite 초기화에 실패해서 ${getStorageKindLabel(health.storeKind)} 저장소로 전환했어요.`;
  }

  return "";
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "알 수 없는 저장소 오류";
}
