import { createJsonApiClient, defaultTimeoutMs } from "./ai-api-client.mjs";
import { OrganizeProviderError } from "./organize/organize-provider.mjs";

function buildSearchInstruction({ query, memos }) {
  return [
    "You are an AI memo retriever for a desktop note app.",
    "Read all memos and choose the memos that are most relevant to the user's natural-language request.",
    "Return ONLY JSON matching the schema.",
    "Do not explain. Do not include scores or reasons.",
    "Pick only memo ids that should appear in the result list, in descending relevance order.",
    "Prefer higher recall when the user asks broad questions, but avoid clearly unrelated memos.",
    "<query>",
    query,
    "</query>",
    "<memos>",
    JSON.stringify(
      memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        body: memo.body
      }))
    ),
    "</memos>"
  ].join("\n");
}

function buildSearchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["memoIds"],
    properties: {
      memoIds: {
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  };
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildComposeInstruction({ prompt, memos, currentDate = formatLocalDate() }) {
  return [
    "You are an AI memo composition engine for a desktop note app.",
    "You are given ONLY the related memos that may support the user's request.",
    "Compose a useful memo in Korean that matches the user's requested shape, topic, and tone.",
    "Do not force a fixed template. Choose natural headings and structure only when they help the request.",
    "You may summarize, rewrite, group, prioritize, or turn the related memos into an actionable note.",
    "Facts, deadlines, names, and commitments must come from the provided memos unless the user explicitly asks for recommendations.",
    "If the user asks for recommendations, keep them practical, clearly grounded in the user's request and related memos, and do not pretend they were already written in the memos.",
    "If the provided memos do not contain enough support to satisfy the request and recommendations would not answer it, you must refuse instead of writing a memo.",
    "Current local date: " + currentDate + ".",
    "For requests about today's tasks, todo lists, daily plans, or what to do today:",
    "- Use the current local date as the planning date.",
    "- Remove or exclude tasks whose explicit due date is before the current local date, unless the user asks to recover overdue tasks.",
    "- Keep tasks due today or later, and include undated tasks when they still fit the user's request.",
    "- You may recommend reasonable tasks to do today when the user asks what would be good to do today.",
    "- Prefer a concise checklist with optional priority or time hints.",
    "Return ONLY JSON matching the schema.",
    "Set decision to compose or refuse_insufficient_support.",
    "If decision is refuse_insufficient_support, leave title and body empty, leave sourceMemoIds empty, and explain why in message.",
    "If decision is compose, include only memo ids from the provided memos in sourceMemoIds.",
    "<prompt>",
    prompt,
    "</prompt>",
    "<memos>",
    JSON.stringify(
      memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        body: memo.body
      }))
    ),
    "</memos>"
  ].join("\n");
}

function buildComposeSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["decision", "title", "body", "sourceMemoIds", "message"],
    properties: {
      decision: {
        type: "string",
        enum: ["compose", "refuse_insufficient_support"]
      },
      title: { type: "string" },
      body: { type: "string" },
      message: { type: "string" },
      sourceMemoIds: {
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  };
}

export function createAiMemoProvider({ apiClient, apiKey, apiUrl, model, timeoutMs = defaultTimeoutMs, request, currentDate } = {}) {
  const client = apiClient ?? createJsonApiClient({ apiKey, apiUrl, model, timeoutMs, request });

  return {
    async searchMemos({ query, memos }) {
      const parsed = await client.requestJson({
        prompt: buildSearchInstruction({ query, memos }),
        schema: buildSearchSchema(),
        schemaName: "memo_search_result",
        parseFailureMessage: "AI 메모 검색 응답을 해석하지 못했어요."
      });

      return Array.isArray(parsed.memoIds) ? parsed.memoIds.map(String) : [];
    },

    async composeMemos({ prompt, memos }) {
      const parsed = await client.requestJson({
        prompt: buildComposeInstruction({ prompt, memos, currentDate }),
        schema: buildComposeSchema(),
        schemaName: "memo_compose_result",
        parseFailureMessage: "AI 메모 조합 응답을 해석하지 못했어요."
      });

      if (parsed?.decision === "refuse_insufficient_support") {
        return {
          kind: "refused",
          message: typeof parsed.message === "string" && parsed.message.trim()
            ? String(parsed.message)
            : "관련 메모만으로는 요청을 뒷받침할 수 없어 새 메모를 만들지 않았어요."
        };
      }

      if (parsed?.decision !== "compose" || !parsed?.title || !parsed?.body) {
        throw new OrganizeProviderError("API_PARSE_FAILED", "AI 메모 조합 응답을 해석하지 못했어요.");
      }

      return {
        kind: "composed",
        title: String(parsed.title),
        body: String(parsed.body),
        sourceMemoIds: Array.isArray(parsed.sourceMemoIds) ? parsed.sourceMemoIds.map(String) : []
      };
    }
  };
}
