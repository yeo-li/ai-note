export class OrganizeProviderError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = "OrganizeProviderError";
    this.code = code;
    this.cause = cause;
  }
}

export function assertOrganizeProvider(provider) {
  if (!provider || typeof provider.organize !== "function") {
    throw new Error("유효한 OrganizeProvider가 필요합니다.");
  }

  return provider;
}
