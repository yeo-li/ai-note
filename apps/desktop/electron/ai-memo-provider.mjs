import { createJsonApiClient, defaultTimeoutMs } from "./ai-api-client.mjs";
import { OrganizeProviderError } from "./organize/organize-provider.mjs";
import {
  normalizeMemoCategoryValue,
  normalizeMemoCheckboxSyntax,
  serializeMemoCheckboxesForMarkdown
} from "@ai-note/shared/memo";

function buildSearchInstruction({ query, memos, currentDate = formatLocalDate() }) {
  return [
    "You are an AI memo retriever for a desktop note app.",
    "Read all memos and choose the memos that are most relevant to the user's natural-language request.",
    "Each memo includes a category field, which is the Korean label of the category it belongs to, or null if uncategorized.",
    "If the user's request mentions or implies a specific category (e.g. \"업무 카테고리에서 찾아줘\"), prefer memos whose category matches that request, but still weigh the memo's title and body content.",
    ...buildTimeAwarenessInstructions(currentDate, getCurrentWeekRange(parseLocalDate(currentDate))),
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
        title: serializeMemoCheckboxesForMarkdown(memo.title),
        body: serializeMemoCheckboxesForMarkdown(memo.body),
        category: memo.categoryLabel ?? null,
        updatedAt: memo.updatedAt
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

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function getCurrentWeekRange(date = new Date()) {
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: formatLocalDate(monday), end: formatLocalDate(sunday) };
}

function buildTimeAwarenessInstructions(currentDate, weekRange) {
  return [
    "Current local date: " + currentDate + ".",
    "Current week (Monday-Sunday): " + weekRange.start + " to " + weekRange.end + ".",
    "Each memo includes updatedAt, the date it was last edited.",
    "If the user's request includes a time frame (e.g. \"오늘 할 일\", \"이번주 할 일\", \"이번달 일정\"):",
    "- The words \"오늘\", \"내일\", \"이번주\", \"이번달\" written inside a memo's title or body do NOT refer to the current local date above. They refer to the date the memo was last edited (its updatedAt). Never match these words literally against the user's request words; always resolve them to actual dates first.",
    "- Step 1: For each memo, resolve any date or relative time expression in its content to an actual date or date range, using the memo's updatedAt as the reference point for relative expressions.",
    "- Step 2: Compare that resolved date or range against the current local date and the current week range above.",
    "- Step 3: You MUST exclude a memo whose resolved date or period ends before the current local date (i.e. it is entirely in the past), unless the user explicitly asks for past or overdue items. This applies even if the memo's title or topic otherwise looks like a strong match for the request.",
    "- Worked example: current local date is 2026-06-15. A memo updated on 2026-04-25 contains \"오늘 할 일: 보고서 작성\". \"오늘\" here resolves to 2026-04-25, which is before 2026-06-15, so this memo MUST be excluded from a \"오늘 할 일 있어?\" request today, even though it literally contains the word \"오늘\".",
    "- Memos without any time reference may still be included if they otherwise match the request."
  ];
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
    ...buildTimeAwarenessInstructions(currentDate, getCurrentWeekRange(parseLocalDate(currentDate))),
    "For requests about today's tasks, this week's tasks, todo lists, daily plans, or what to do today:",
    "- Use the current local date as the planning date.",
    "- Keep tasks due today or later (per the rules above), and include undated tasks when they still fit the user's request.",
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
        title: serializeMemoCheckboxesForMarkdown(memo.title),
        body: serializeMemoCheckboxesForMarkdown(memo.body),
        updatedAt: memo.updatedAt
      }))
    ),
    "</memos>"
  ].join("\n");
}

function buildCategorizeInstruction({ title, body, categories }) {
  const categoryDescriptions = categories.length > 0
    ? categories.map((category) => `- ${category.id}: ${category.label}${category.description ? ` (${category.description})` : ""}`).join("\n")
    : "(아직 생성된 카테고리가 없어요)";

  return [
    "You are an AI memo categorizer for a desktop note app.",
    "Read the memo and decide which category fits its content best.",
    "Be conservative about reusing existing categories: only set useExisting to true and categoryId when an existing category is a clear, strong match for the memo.",
    "Do not force-fit a memo into an existing category just because it is the closest option. If no existing category clearly fits, set useExisting to false.",
    "Before deciding to create a new category (useExisting false), check whether any existing category's label or description already covers the same or a very similar topic. If one does, set useExisting to true and use that category's id instead of creating a near-duplicate.",
    "When useExisting is false, set newCategoryLabel to a short new Korean category label (under 32 characters) and newCategoryDescription to a short Korean sentence describing what kind of memos belong in this category, for future reference.",
    "Never use a generic catch-all label such as \"미분류\", \"기타\", \"일반\", \"잡동사니\", or similar. A new category label must describe a specific topic or type of memo.",
    "If the memo's content is too short, vague, or generic to confidently determine a specific new category, set useExisting to false and leave newCategoryLabel and newCategoryDescription as empty strings — the memo will simply remain uncategorized.",
    "When useExisting is true, set newCategoryLabel and newCategoryDescription to empty strings.",
    "Return ONLY JSON matching the schema.",
    "Existing categories:",
    categoryDescriptions,
    "<memo>",
    JSON.stringify({
      title: serializeMemoCheckboxesForMarkdown(title),
      body: serializeMemoCheckboxesForMarkdown(body)
    }),
    "</memo>"
  ].join("\n");
}

function buildCategorizeSchema(categories) {
  const categoryIds = categories.map((category) => category.id);

  return {
    type: "object",
    additionalProperties: false,
    required: ["useExisting", "categoryId", "newCategoryLabel", "newCategoryDescription"],
    properties: {
      useExisting: { type: "boolean" },
      categoryId: categoryIds.length > 0 ? { type: "string", enum: categoryIds } : { type: "string" },
      newCategoryLabel: { type: "string" },
      newCategoryDescription: { type: "string" }
    }
  };
}

function buildCategorizeAllInstruction({ memos, categories }) {
  const categoryDescriptions = categories.length > 0
    ? categories.map((category) => `- ${category.id}: ${category.label}${category.description ? ` (${category.description})` : ""}`).join("\n")
    : "(아직 생성된 카테고리가 없어요)";

  return [
    "You are an AI memo categorizer for a desktop note app.",
    "Read each memo and decide which category fits its content best.",
    "Be conservative about reusing existing categories: only set useExisting to true and categoryId when an existing category is a clear, strong match for the memo.",
    "Do not force-fit a memo into an existing category just because it is the closest option. If no existing category clearly fits, set useExisting to false.",
    "Before deciding to create a new category (useExisting false), check whether any existing category's label or description already covers the same or a very similar topic. If one does, set useExisting to true and use that category's id instead of creating a near-duplicate.",
    "When useExisting is false, set newCategoryLabel to a short new Korean category label (under 32 characters) and newCategoryDescription to a short Korean sentence describing what kind of memos belong in this category, for future reference.",
    "Never use a generic catch-all label such as \"미분류\", \"기타\", \"일반\", \"잡동사니\", or similar. A new category label must describe a specific topic or type of memo.",
    "If a memo's content is too short, vague, or generic to confidently determine a specific new category, set useExisting to false and leave newCategoryLabel and newCategoryDescription as empty strings for that memo — it will simply remain uncategorized.",
    "When useExisting is true, set newCategoryLabel and newCategoryDescription to empty strings.",
    "If multiple memos belong together in the same brand-new category, reuse the exact same newCategoryLabel text for all of them so they can be grouped into one category.",
    "Return ONLY JSON matching the schema.",
    "Return exactly one result per memo, in the same order as the memos, with each memoId matching the corresponding memo's id.",
    "Existing categories:",
    categoryDescriptions,
    "<memos>",
    JSON.stringify(memos.map((memo) => ({
      id: memo.id,
      title: serializeMemoCheckboxesForMarkdown(memo.title),
      body: serializeMemoCheckboxesForMarkdown(memo.body)
    }))),
    "</memos>"
  ].join("\n");
}

function buildCategorizeAllSchema(categories) {
  const categoryIds = categories.map((category) => category.id);

  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["memoId", "useExisting", "categoryId", "newCategoryLabel", "newCategoryDescription"],
          properties: {
            memoId: { type: "string" },
            useExisting: { type: "boolean" },
            categoryId: categoryIds.length > 0 ? { type: "string", enum: categoryIds } : { type: "string" },
            newCategoryLabel: { type: "string" },
            newCategoryDescription: { type: "string" }
          }
        }
      }
    }
  };
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
        prompt: buildSearchInstruction({ query, memos, currentDate }),
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
        body: normalizeMemoCheckboxSyntax(parsed.body),
        sourceMemoIds: Array.isArray(parsed.sourceMemoIds) ? parsed.sourceMemoIds.map(String) : []
      };
    },

    async categorizeMemo({ title, body, categories }) {
      const parsed = await client.requestJson({
        prompt: buildCategorizeInstruction({ title, body, categories }),
        schema: buildCategorizeSchema(categories),
        schemaName: "memo_categorize_result",
        parseFailureMessage: "AI 메모 분류 응답을 해석하지 못했어요."
      });

      if (parsed?.useExisting === true) {
        const categoryId = typeof parsed.categoryId === "string" ? parsed.categoryId : "";

        if (!categories.some((category) => category.id === categoryId)) {
          throw new OrganizeProviderError("API_PARSE_FAILED", "AI 메모 분류 응답을 해석하지 못했어요.");
        }

        return { categoryId, isNewCategory: false };
      }

      if (parsed?.useExisting === false) {
        const newCategoryLabel = normalizeMemoCategoryValue(parsed.newCategoryLabel);

        if (!newCategoryLabel) {
          return { categoryId: null, isNewCategory: false };
        }

        const newCategoryDescription = typeof parsed.newCategoryDescription === "string" ? parsed.newCategoryDescription.trim() : "";

        return { newCategoryLabel, newCategoryDescription, isNewCategory: true };
      }

      throw new OrganizeProviderError("API_PARSE_FAILED", "AI 메모 분류 응답을 해석하지 못했어요.");
    },

    async categorizeMemos({ memos, categories }) {
      if (memos.length === 0) {
        return [];
      }

      const parsed = await client.requestJson({
        prompt: buildCategorizeAllInstruction({ memos, categories }),
        schema: buildCategorizeAllSchema(categories),
        schemaName: "memo_categorize_all_result",
        parseFailureMessage: "AI 메모 일괄 분류 응답을 해석하지 못했어요."
      });

      const results = Array.isArray(parsed?.results) ? parsed.results : [];
      const resultsByMemoId = new Map();

      for (const result of results) {
        const memoId = typeof result?.memoId === "string" ? result.memoId : "";

        if (!memoId || resultsByMemoId.has(memoId)) {
          continue;
        }

        if (result.useExisting === true) {
          const categoryId = typeof result.categoryId === "string" ? result.categoryId : "";

          if (categories.some((category) => category.id === categoryId)) {
            resultsByMemoId.set(memoId, { categoryId, isNewCategory: false });
          }

          continue;
        }

        if (result.useExisting === false) {
          const newCategoryLabel = normalizeMemoCategoryValue(result.newCategoryLabel);

          if (!newCategoryLabel) {
            continue;
          }

          const newCategoryDescription = typeof result.newCategoryDescription === "string" ? result.newCategoryDescription.trim() : "";
          resultsByMemoId.set(memoId, { newCategoryLabel, newCategoryDescription, isNewCategory: true });
        }
      }

      return memos.map((memo) => resultsByMemoId.get(memo.id) ?? null);
    }
  };
}
