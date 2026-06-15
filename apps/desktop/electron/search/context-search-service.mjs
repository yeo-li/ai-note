function getSearchTerms(query) {
  return query
    .toLocaleLowerCase()
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

export function buildContextSearchPreview(memo, query) {
  const body = typeof memo.body === "string" ? memo.body.trim() : "";
  const title = typeof memo.title === "string" ? memo.title.trim() : "";
  const source = body || title;

  if (!source) {
    return "";
  }

  const normalizedSource = source.toLocaleLowerCase();
  const matchedTerm = getSearchTerms(query).find((term) => normalizedSource.includes(term));
  const matchIndex = matchedTerm ? normalizedSource.indexOf(matchedTerm) : -1;
  const startIndex = matchIndex >= 0 ? Math.max(0, matchIndex - 32) : 0;
  const endIndex = Math.min(source.length, startIndex + 96);
  const prefix = startIndex > 0 ? "..." : "";
  const suffix = endIndex < source.length ? "..." : "";

  return `${prefix}${source.slice(startIndex, endIndex)}${suffix}`;
}

export function buildContextSearchReason(memo, query) {
  const searchableText = `${memo.title ?? ""} ${memo.body ?? ""}`.toLocaleLowerCase();
  const matchedTerms = getSearchTerms(query).filter((term) => searchableText.includes(term)).slice(0, 3);

  if (matchedTerms.length > 0) {
    return `요청어 "${matchedTerms.join(", ")}"와 연결된 내용이 있습니다.`;
  }

  return "AI가 요청 맥락과 관련된 메모로 선택했습니다.";
}

/**
 * AI 기반 맥락 검색(memo:ai-search)의 조립 로직을 캡슐화한다.
 */
export function createContextSearchService({ listMemos, listCategories = async () => [], aiMemoProvider }) {
  return {
    async search(query) {
      const [memos, categories] = await Promise.all([listMemos(), listCategories()]);
      const categoryLabelsById = new Map(categories.map((category) => [category.id, category.label]));
      const memosWithCategoryLabel = memos.map((memo) => ({
        ...memo,
        categoryLabel: memo.category ? categoryLabelsById.get(memo.category) ?? null : null
      }));
      const memoIds = await aiMemoProvider.searchMemos({
        query,
        memos: memosWithCategoryLabel
      });
      const memoMap = new Map(memos.map((memo) => [memo.id, memo]));

      return memoIds
        .map((memoId) => memoMap.get(memoId))
        .filter(Boolean)
        .map((memo) => ({
          memo,
          preview: buildContextSearchPreview(memo, query),
          reason: buildContextSearchReason(memo, query)
        }));
    }
  };
}
