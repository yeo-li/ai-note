import assert from "node:assert/strict";
import test from "node:test";
import { createOrganizeOrchestrator } from "./organize-orchestrator.mjs";
import { OrganizeProviderError } from "./organize-provider.mjs";

test("organize orchestrator uses the primary provider when it succeeds", async () => {
  const orchestrator = createOrganizeOrchestrator({
    provider: {
      async organize() {
        return {
          intent: "polish",
          original: "hello",
          suggested: "hello polished",
          summary: "정리했습니다.",
          provider: "api",
          fallbackErrorMessage: null
        };
      }
    }
  });

  const result = await orchestrator.organize({ memoId: "memo-1", body: "hello", intent: "polish" });
  assert.equal(result.suggested, "hello polished");
  assert.equal(result.provider, "api");
  assert.equal(result.fallbackErrorMessage, null);
});

test("organize orchestrator falls back to the secondary provider on api errors", async () => {
  const orchestrator = createOrganizeOrchestrator({
    provider: {
      async organize() {
        throw new OrganizeProviderError("API_KEY_MISSING", "API_KEY 환경변수가 필요해요.");
      }
    },
    fallbackProvider: {
      async organize() {
        return {
          intent: "polish",
          original: "hello",
          suggested: "fallback result",
          summary: "로컬 규칙 기반으로 정리했어요.",
          provider: "local",
          fallbackErrorMessage: null
        };
      }
    }
  });

  const result = await orchestrator.organize({ memoId: "memo-1", body: "hello", intent: "polish" });
  assert.equal(result.suggested, "fallback result");
  assert.equal(result.provider, "local");
  assert.equal(result.fallbackErrorMessage, "API_KEY 환경변수가 필요해요.");
});
