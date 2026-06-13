export function normalizeComposeInput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  const intent = value.intent === "polish" || value.intent === "polite" ? value.intent : null;

  if (!prompt || !intent) {
    return null;
  }

  return {
    prompt,
    intent
  };
}

export function createComposeRefusal({ refusalReason, message, relatedMemoIds = [] }) {
  return {
    kind: "refused",
    refusalReason,
    message,
    relatedMemoIds,
    relatedCount: relatedMemoIds.length
  };
}

/**
 * AI 메모 조합(memo:compose)의 조립 로직을 캡슐화한다.
 * onMemoBusyChange(memoId, busy)는 조합 대상 메모의 진행 상태 알림에 사용된다.
 */
export function createComposeService({ listMemos, aiMemoProvider, onMemoBusyChange = () => {} }) {
  return {
    async compose(composeInput) {
      const memos = await listMemos();
      const busyMemoIds = [];

      try {
        if (memos.length === 0) {
          return createComposeRefusal({
            refusalReason: "no_related_memos",
            message: "작성된 메모가 없어 조합할 수 없어요. 먼저 관련 메모를 남겨 주세요."
          });
        }

        const relatedMemoIds = await aiMemoProvider.searchMemos({
          query: composeInput.prompt,
          memos
        });
        const memoMap = new Map(memos.map((memo) => [memo.id, memo]));
        const relatedMemos = relatedMemoIds.map((memoId) => memoMap.get(memoId)).filter(Boolean);
        const relatedMemoIdSet = new Set(relatedMemos.map((memo) => memo.id));

        if (relatedMemos.length === 0) {
          return createComposeRefusal({
            refusalReason: "no_related_memos",
            message: "관련 메모를 찾지 못해 새 메모를 만들지 않았어요. 프롬프트를 더 구체적으로 적어 주세요.",
            relatedMemoIds: []
          });
        }

        relatedMemos.forEach((memo) => {
          busyMemoIds.push(memo.id);
          onMemoBusyChange(memo.id, true);
        });

        const result = await aiMemoProvider.composeMemos({
          prompt: composeInput.prompt,
          memos: relatedMemos
        });

        if (result.kind === "refused") {
          return createComposeRefusal({
            refusalReason: "insufficient_support",
            message: result.message,
            relatedMemoIds: relatedMemos.map((memo) => memo.id)
          });
        }

        const sourceMemoIds = result.sourceMemoIds.filter((memoId) => relatedMemoIdSet.has(memoId));

        if (sourceMemoIds.length === 0) {
          return createComposeRefusal({
            refusalReason: "insufficient_support",
            message: "관련 메모는 찾았지만 근거가 충분하지 않아 새 메모를 만들지 않았어요.",
            relatedMemoIds: relatedMemos.map((memo) => memo.id)
          });
        }

        return {
          kind: "composed",
          title: result.title,
          body: result.body,
          relatedMemoIds: relatedMemos.map((memo) => memo.id),
          relatedCount: relatedMemos.length,
          sourceMemoIds,
          sourceCount: sourceMemoIds.length
        };
      } finally {
        busyMemoIds.forEach((memoId) => {
          onMemoBusyChange(memoId, false);
        });
      }
    }
  };
}
