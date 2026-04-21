export type MemoStoreKind = "sqlite" | "json" | "memory";

export type MemoStoreHealth = {
  bridgeConnected: boolean;
  ready: boolean;
  storeKind: MemoStoreKind;
  filePath?: string;
  fallbackReason?: string;
  errorMessage?: string;
};
