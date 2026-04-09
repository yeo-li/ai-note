const PREVIEW_LENGTH = 120;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

function normalizeText(value) {
  return typeof value === "string" ? value.normalize("NFKC").toLowerCase().trim() : "";
}

function tokenize(value) {
  const tokens = normalizeText(value).match(TOKEN_PATTERN) ?? [];
  return [...new Set(tokens)];
}

function unique(values) {
  return [...new Set(values)];
}

function createPreview(text, matchedTerms) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "아직 내용이 없습니다";
  }

  const normalizedCompact = normalizeText(compact);
  const firstTermIndex = matchedTerms.reduce((closest, term) => {
    const index = normalizedCompact.indexOf(term);

    if (index === -1) {
      return closest;
    }

    return closest === -1 ? index : Math.min(closest, index);
  }, -1);

  if (firstTermIndex === -1 || compact.length <= PREVIEW_LENGTH) {
    return compact.length > PREVIEW_LENGTH ? `${compact.slice(0, PREVIEW_LENGTH).trimEnd()}…` : compact;
  }

  const start = Math.max(0, firstTermIndex - 28);
  const end = Math.min(compact.length, start + PREVIEW_LENGTH);
  const excerpt = compact.slice(start, end).trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < compact.length ? "…" : "";

  return `${prefix}${excerpt}${suffix}`;
}

export function scoreMemoLexically(memo, query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return null;
  }

  const queryTokens = tokenize(normalizedQuery);

  if (queryTokens.length === 0) {
    return null;
  }

  const title = memo?.title ?? "";
  const body = memo?.body ?? "";
  const normalizedTitle = normalizeText(title);
  const normalizedBody = normalizeText(body);
  const titleTokens = tokenize(title);
  const bodyTokens = tokenize(body);
  const matchedTerms = [];
  let score = 0;

  if (normalizedTitle.includes(normalizedQuery)) {
    score += 120;
  }

  if (normalizedBody.includes(normalizedQuery)) {
    score += 72;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 18;
  }

  for (const token of queryTokens) {
    let tokenScore = 0;

    if (titleTokens.includes(token)) {
      tokenScore += 42;
    } else if (normalizedTitle.includes(token)) {
      tokenScore += 18;
    }

    if (bodyTokens.includes(token)) {
      tokenScore += 20;
    } else if (normalizedBody.includes(token)) {
      tokenScore += 8;
    }

    if (tokenScore > 0) {
      matchedTerms.push(token);
      score += tokenScore;
    }
  }

  if (matchedTerms.length === queryTokens.length && queryTokens.length > 1) {
    score += 36;
  }

  if (score <= 0) {
    return null;
  }

  return {
    score,
    matchedTerms: unique(matchedTerms),
    preview: createPreview(body || title, unique(matchedTerms))
  };
}

export function rankMemoSearchResults(memos, query) {
  return memos
    .map((memo) => {
      const scored = scoreMemoLexically(memo, query);

      if (!scored) {
        return null;
      }

      return {
        memo,
        score: scored.score,
        preview: scored.preview,
        matchedTerms: scored.matchedTerms
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const updatedDelta = Date.parse(right.memo.updatedAt) - Date.parse(left.memo.updatedAt);

      if (updatedDelta !== 0) {
        return updatedDelta;
      }

      return Date.parse(right.memo.createdAt) - Date.parse(left.memo.createdAt);
    });
}

export function createMemoSearchService({
  listMemos,
  rankMemos = rankMemoSearchResults
}) {
  return {
    async search(query) {
      const trimmedQuery = normalizeText(query);

      if (!trimmedQuery) {
        return [];
      }

      const memos = await listMemos();
      return rankMemos(memos, trimmedQuery);
    }
  };
}
