import { assertOrganizeProvider, OrganizeProviderError } from "./organize-provider.mjs";

function isProviderError(error) {
  return error instanceof OrganizeProviderError;
}

export function createOrganizeOrchestrator({ provider, fallbackProvider = null }) {
  const primaryProvider = assertOrganizeProvider(provider);
  const safeFallbackProvider = fallbackProvider ? assertOrganizeProvider(fallbackProvider) : null;

  return {
    async organize(input) {
      try {
        return await primaryProvider.organize(input);
      } catch (error) {
        if (!safeFallbackProvider || !isProviderError(error)) {
          throw error;
        }

        if (!["CLI_NOT_FOUND", "CLI_NOT_AUTHENTICATED", "CLI_TIMEOUT", "CLI_FAILED", "CLI_PARSE_FAILED"].includes(error.code)) {
          throw error;
        }

        const fallbackResult = await safeFallbackProvider.organize(input);

        return {
          ...fallbackResult,
          provider: fallbackResult.provider ?? "local",
          fallbackErrorMessage: error.message
        };
      }
    }
  };
}
