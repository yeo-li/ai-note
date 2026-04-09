import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import type {
  Memo,
  MemoCreateInput,
  MemoOrganizeIntent,
  MemoOrganizeResult,
  MemoSearchResult,
  MemoUpdateInput
} from "../shared/memo";

const UNTITLED_MEMO_LABEL = "제목 없는 메모";

const platformName: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux"
};

function createFallbackMemo(overrides: Partial<Memo> = {}): Memo {
  const timestamp = overrides.createdAt ?? new Date().toISOString();

  return {
    id:
      overrides.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `memo-${Math.random().toString(36).slice(2, 10)}`),
    title: overrides.title ?? "",
    body: overrides.body ?? "",
    createdAt: timestamp,
    updatedAt: overrides.updatedAt ?? timestamp
  };
}

function getFallbackSeed() {
  const base = new Date();
  const offset = (minutes: number) => new Date(base.getTime() - minutes * 60_000).toISOString();

  return [
    createFallbackMemo({
      title: "오늘 할 일",
      body: "점심 이후 구매팀에 전화하기.\n수정된 일정 다시 확인하기.",
      createdAt: offset(90),
      updatedAt: offset(12)
    }),
    createFallbackMemo({
      title: "교수님 메일 초안",
      body: "안녕하세요 교수님. 오늘 회의 내용을 정리해서 전달드립니다.\n말투를 더 공손하게 다듬고 싶습니다.",
      createdAt: offset(220),
      updatedAt: offset(35)
    })
  ];
}

function sortMemosByRecency(memos: Memo[]) {
  return [...memos].sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );
}

function getMemoPreview(body: string) {
  const cleaned = body.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "아직 내용이 없습니다";
  }

  return cleaned.length > 90 ? `${cleaned.slice(0, 90).trimEnd()}…` : cleaned;
}

function formatMemoTimestamp(iso: string) {
  const timestamp = new Date(iso);

  if (Number.isNaN(timestamp.getTime())) {
    return "방금 전";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function formatPlatform(platform: string) {
  return platformName[platform] ?? platform;
}

function getInitialStatus() {
  return window.memoAPI ? "로컬 메모 저장소 연결 중" : "브라우저 미리보기 모드";
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase().trim();
}

function tokenizeSearchQuery(value: string) {
  return [...new Set(normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [])];
}

function searchFallbackMemos(memos: Memo[], query: string): MemoSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  const queryTokens = tokenizeSearchQuery(normalizedQuery);

  if (queryTokens.length === 0) {
    return [];
  }

  return sortMemosByRecency(memos)
    .map((memo) => {
      const title = normalizeSearchText(memo.title);
      const body = normalizeSearchText(memo.body);
      let score = 0;
      const matchedTerms: string[] = [];

      if (title.includes(normalizedQuery)) {
        score += 100;
      }

      if (body.includes(normalizedQuery)) {
        score += 56;
      }

      for (const token of queryTokens) {
        if (title.includes(token)) {
          score += 28;
          matchedTerms.push(token);
          continue;
        }

        if (body.includes(token)) {
          score += 12;
          matchedTerms.push(token);
        }
      }

      if (score <= 0) {
        return null;
      }

      return {
        memo,
        score,
        preview: getMemoPreview(memo.body || memo.title),
        matchedTerms: [...new Set(matchedTerms)]
      };
    })
    .filter((result): result is MemoSearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score);
}

async function loadInitialMemos() {
  if (!window.memoAPI) {
    return getFallbackSeed();
  }

  return window.memoAPI.list();
}

export function MemoWorkspace() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState(getInitialStatus());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [organizeResult, setOrganizeResult] = useState<MemoOrganizeResult | null>(null);
  const [isOrganizing, setIsOrganizing] = useState<MemoOrganizeIntent | null>(null);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("자연어로 메모 제목과 내용을 검색해 보세요.");
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const activeMemoIdRef = useRef<string | null>(null);
  const organizeRequestRef = useRef(0);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    let cancelled = false;

    async function hydrateMemos() {
      try {
        const initialMemos = await loadInitialMemos();

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setMemos(initialMemos);
          setActiveMemoId(initialMemos[0]?.id ?? null);
          setStatusMessage(window.memoAPI ? "로컬 메모 저장소가 연결되었습니다" : "브라우저 미리보기 데이터를 불러왔습니다");
          setErrorMessage(null);
          setIsLoading(false);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "메모를 불러오지 못했습니다.");
        setStatusMessage("로컬 메모를 불러오지 못했습니다");
        setIsLoading(false);
      }
    }

    void hydrateMemos();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    activeMemoIdRef.current = activeMemoId;
  }, [activeMemoId]);

  useEffect(() => {
    organizeRequestRef.current += 1;
    setOrganizeResult(null);
    setIsOrganizing(null);
  }, [activeMemoId]);

  useEffect(() => {
    if (!deferredSearchQuery) {
      setSearchResults([]);
      setSearchErrorMessage(null);
      setSearchMessage("자연어로 메모 제목과 내용을 검색해 보세요.");
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setSearchErrorMessage(null);

      const searchPromise = window.memoAPI?.search
        ? window.memoAPI.search(deferredSearchQuery)
        : Promise.resolve(searchFallbackMemos(memos, deferredSearchQuery));

      void searchPromise.then(
        (results) => {
          if (cancelled) {
            return;
          }

          startTransition(() => {
            setSearchResults(results);
            setSearchMessage(
              results.length > 0
                ? `${results.length}개의 관련 메모를 찾았습니다`
                : "관련 메모가 없습니다. 사람, 주제, 상황 키워드로 다시 검색해 보세요."
            );
            setIsSearching(false);
          });
        },
        (error) => {
          if (cancelled) {
            return;
          }

          setSearchErrorMessage(error instanceof Error ? error.message : "검색에 실패했습니다.");
          setSearchMessage("문맥 검색을 실행하지 못했습니다");
          setIsSearching(false);
        }
      );
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deferredSearchQuery, memos]);

  const orderedMemos = sortMemosByRecency(memos);
  const activeMemo = orderedMemos.find((memo) => memo.id === activeMemoId) ?? orderedMemos[0] ?? null;
  const runtimeLabel = window.desktopAPI ? formatPlatform(window.desktopAPI.platform) : "브라우저";
  const runtimeDetail = window.desktopAPI
    ? `${window.desktopAPI.versions.electron} / ${window.desktopAPI.versions.chrome}`
    : "프리로드 브리지 없음";
  const isSearchActive = deferredSearchQuery.length > 0;

  function replaceMemo(nextMemo: Memo) {
    setMemos((current) => [nextMemo, ...current.filter((memo) => memo.id !== nextMemo.id)]);
  }

  async function createMemo() {
    const input: MemoCreateInput = {
      title: "",
      body: ""
    };

    try {
      const nextMemo = window.memoAPI ? await window.memoAPI.create(input) : createFallbackMemo(input);

      replaceMemo(nextMemo);
      setActiveMemoId(nextMemo.id);
      setStatusMessage(window.memoAPI ? "메모를 저장했습니다" : "브라우저 미리보기 메모를 만들었습니다");
      setErrorMessage(null);
      setOrganizeResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "메모를 만들지 못했습니다.");
      setStatusMessage("메모 생성에 실패했습니다");
    }
  }

  async function persistMemoUpdate(memoId: string, updates: MemoUpdateInput) {
    if (!window.memoAPI) {
      return null;
    }

    return window.memoAPI.update(memoId, updates);
  }

  function updateActiveMemo(field: keyof Pick<Memo, "title" | "body">, value: string) {
    if (!activeMemo) {
      return;
    }

    const updatedAt = new Date().toISOString();

    setMemos((current) =>
      current.map((memo) =>
        memo.id === activeMemo.id
          ? {
              ...memo,
              [field]: value,
              updatedAt
            }
          : memo
      )
    );
    setStatusMessage(window.memoAPI ? "메모 저장 중..." : "브라우저 미리보기 모드");
    setErrorMessage(null);
    setOrganizeResult(null);

    void persistMemoUpdate(activeMemo.id, { [field]: value }).then(
      (persisted) => {
        if (!persisted && window.memoAPI) {
          throw new Error("선택한 메모를 찾을 수 없습니다.");
        }

        if (persisted) {
          replaceMemo(persisted);
        }

        setStatusMessage(window.memoAPI ? "메모를 저장했습니다" : "브라우저 미리보기 모드");
      },
      (error) => {
        setErrorMessage(error instanceof Error ? error.message : "메모를 저장하지 못했습니다.");
        setStatusMessage("메모 저장에 실패했습니다");
      }
    );
  }

  async function deleteActiveMemo() {
    if (!activeMemo) {
      return;
    }

    const currentIndex = orderedMemos.findIndex((memo) => memo.id === activeMemo.id);
    const fallback = orderedMemos[currentIndex + 1] ?? orderedMemos[currentIndex - 1] ?? null;

    try {
      const removed = window.memoAPI ? await window.memoAPI.delete(activeMemo.id) : true;

      if (!removed) {
        throw new Error("선택한 메모를 삭제하지 못했습니다.");
      }

      setMemos((current) => current.filter((memo) => memo.id !== activeMemo.id));
      setActiveMemoId(fallback?.id ?? null);
      setStatusMessage(window.memoAPI ? "메모를 삭제했습니다" : "브라우저 미리보기 메모를 삭제했습니다");
      setErrorMessage(null);
      setOrganizeResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "메모를 삭제하지 못했습니다.");
      setStatusMessage("메모 삭제에 실패했습니다");
    }
  }

  async function runOrganize(intent: MemoOrganizeIntent) {
    if (!activeMemo || !window.memoAPI) {
      return;
    }

    const memoId = activeMemo.id;
    const requestId = organizeRequestRef.current + 1;

    organizeRequestRef.current = requestId;
    setIsOrganizing(intent);
    setErrorMessage(null);
    setStatusMessage(intent === "polite" ? "공손한 문체로 바꾸는 중..." : "문장을 다듬는 중...");

    try {
      const result = await window.memoAPI.organize({
        memoId,
        title: activeMemo.title,
        body: activeMemo.body,
        intent
      });

      if (organizeRequestRef.current !== requestId || activeMemoIdRef.current !== memoId) {
        return;
      }

      setOrganizeResult(result);
      setStatusMessage(result.summary);
    } catch (error) {
      if (organizeRequestRef.current !== requestId || activeMemoIdRef.current !== memoId) {
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : "AI 정리를 실행하지 못했습니다.");
      setStatusMessage("AI 정리에 실패했습니다");
    } finally {
      if (organizeRequestRef.current === requestId && activeMemoIdRef.current === memoId) {
        setIsOrganizing(null);
      }
    }
  }

  async function applyOrganizeSuggestion() {
    if (!activeMemo || !organizeResult) {
      return;
    }

    const nextBody = organizeResult.suggested;
    const updatedAt = new Date().toISOString();

    setIsApplyingSuggestion(true);
    setMemos((current) =>
      current.map((memo) =>
        memo.id === activeMemo.id
          ? {
              ...memo,
              body: nextBody,
              updatedAt
            }
          : memo
      )
    );

    try {
      const persisted = await persistMemoUpdate(activeMemo.id, { body: nextBody });

      if (!persisted && window.memoAPI) {
        throw new Error("선택한 메모를 찾을 수 없습니다.");
      }

      if (persisted) {
        replaceMemo(persisted);
      }

      setOrganizeResult(null);
      setStatusMessage("정리된 문장을 메모에 반영했습니다");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "정리 결과를 적용하지 못했습니다.");
      setStatusMessage("정리 결과 적용에 실패했습니다");
    } finally {
      setIsApplyingSuggestion(false);
    }
  }

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div className="workspace__brand">
          <p className="workspace__eyebrow">데스크톱 메모 워크스페이스</p>
          <h1>AI Note</h1>
          <p className="workspace__lede">
            스티키 메모처럼 빠르게 적고, 로컬에 저장한 뒤, 한국어로 검색하고 바로 문장을 다듬을 수 있도록
            미리보기 흐름을 합쳤습니다.
          </p>
        </div>

        <div className="workspace__status">
          <span className="badge badge--soft">{runtimeLabel}</span>
          <span className="badge">{statusMessage}</span>
          <span className="badge">{orderedMemos.length}개의 메모</span>
          <span className="badge">{isSearchActive ? `${searchResults.length}개 찾음` : "검색 준비됨"}</span>
        </div>
      </header>

      <section className="workspace__shell">
        <aside className="panel panel--sidebar">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">메모 보관함</p>
              <h2>최근 메모</h2>
            </div>
            <button className="button button--primary" type="button" onClick={() => void createMemo()}>
              + 새 메모
            </button>
          </div>

          <div className="memo-list" role="list" aria-label="메모 목록">
            {orderedMemos.map((memo) => {
              const isActive = memo.id === activeMemo?.id;

              return (
                <button
                  key={memo.id}
                  type="button"
                  className={`memo-card${isActive ? " memo-card--active" : ""}`}
                  onClick={() => setActiveMemoId(memo.id)}
                >
                  <span className="memo-card__title-row">
                    <strong>{memo.title || UNTITLED_MEMO_LABEL}</strong>
                    <span className="memo-card__date">{formatMemoTimestamp(memo.updatedAt)}</span>
                  </span>
                  <span className="memo-card__preview">{getMemoPreview(memo.body)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel panel--editor" aria-label="메모 편집기">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">편집기</p>
              <h2>{activeMemo ? "메모 작성 및 정리" : "첫 메모를 만들어 보세요"}</h2>
            </div>

            <div className="panel__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void deleteActiveMemo()}
                disabled={!activeMemo}
              >
                삭제
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void runOrganize("polish")}
                disabled={!activeMemo || !window.memoAPI || isOrganizing !== null}
              >
                {isOrganizing === "polish" ? "다듬는 중..." : "문장 다듬기"}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void runOrganize("polite")}
                disabled={!activeMemo || !window.memoAPI || isOrganizing !== null}
              >
                {isOrganizing === "polite" ? "변환 중..." : "공손하게"}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <h3>메모를 불러오는 중입니다</h3>
              <p>로컬 저장소를 준비하고 있습니다.</p>
            </div>
          ) : activeMemo ? (
            <div className="editor">
              <label className="field">
                <span className="field__label">제목</span>
                <input
                  className="input"
                  type="text"
                  value={activeMemo.title}
                  onChange={(event) => updateActiveMemo("title", event.target.value)}
                  placeholder="메모 제목"
                />
              </label>

              <label className="field field--grow">
                <span className="field__label">본문</span>
                <textarea
                  className="textarea"
                  value={activeMemo.body}
                  onChange={(event) => updateActiveMemo("body", event.target.value)}
                  placeholder="메모, 전화 내용, 회의 정리, 교수님께 보낼 초안을 자유롭게 적어보세요..."
                />
              </label>

              {organizeResult ? (
                <section className="organize-preview" aria-label="AI 정리 미리보기">
                  <div className="organize-preview__header">
                    <div>
                      <p className="panel__kicker">AI 정리 미리보기</p>
                      <h3>{organizeResult.intent === "polite" ? "공손한 문체" : "문장 다듬기"}</h3>
                    </div>
                    <div className="panel__actions">
                      <button
                        className="button button--primary"
                        type="button"
                        onClick={() => void applyOrganizeSuggestion()}
                        disabled={isApplyingSuggestion || organizeResult.suggested.length === 0}
                      >
                        {isApplyingSuggestion ? "적용 중..." : "적용하기"}
                      </button>
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => setOrganizeResult(null)}
                        disabled={isApplyingSuggestion}
                      >
                        닫기
                      </button>
                    </div>
                  </div>

                  <p className="organize-preview__summary">{organizeResult.summary}</p>

                  <div className="organize-preview__grid">
                    <div className="organize-preview__panel">
                      <span className="field__label">원문</span>
                      <pre>{organizeResult.original || "정리할 내용이 없습니다."}</pre>
                    </div>
                    <div className="organize-preview__panel organize-preview__panel--accent">
                      <span className="field__label">제안 결과</span>
                      <pre>{organizeResult.suggested || "비어 있는 메모는 정리할 수 없습니다."}</pre>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="editor__meta">
                <span>생성 {formatMemoTimestamp(activeMemo.createdAt)}</span>
                <span>수정 {formatMemoTimestamp(activeMemo.updatedAt)}</span>
                <span>{window.memoAPI ? "데스크톱 메모 API 연결됨" : "브라우저 미리보기 모드"}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h3>선택된 메모가 없습니다</h3>
              <p>메모를 하나 만들면 바로 저장되고, 문장 다듬기와 문맥 검색을 이어서 써볼 수 있습니다.</p>
              <button className="button button--primary" type="button" onClick={() => void createMemo()}>
                + 새 메모 만들기
              </button>
            </div>
          )}

          {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
        </section>

        <aside className="panel panel--tools">
          <div className="tool-card">
            <p className="panel__kicker">문맥 검색</p>
            <h2>의미로 찾기</h2>
            <p>{searchMessage}</p>

            <label className="field">
              <span className="field__label">메모 검색</span>
              <input
                className="input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="예: 오늘 할 일, 교수님 메일, 구매팀 전화"
              />
            </label>

            <div className="tool-card__toolbar">
              <span className="badge">{isSearching ? "검색 중..." : "관련 메모 목록만 표시"}</span>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => setSearchQuery("")}
                disabled={!searchQuery}
              >
                지우기
              </button>
            </div>

            {searchErrorMessage ? <p className="inline-error">{searchErrorMessage}</p> : null}

            {isSearchActive ? (
              searchResults.length > 0 ? (
                <div className="search-results" role="list" aria-label="문맥 검색 결과">
                  {searchResults.map((result) => {
                    const isSelected = result.memo.id === activeMemo?.id;

                    return (
                      <button
                        key={result.memo.id}
                        type="button"
                        className={`search-result${isSelected ? " search-result--active" : ""}`}
                        onClick={() => setActiveMemoId(result.memo.id)}
                      >
                        <span className="search-result__title-row">
                          <strong>{result.memo.title || UNTITLED_MEMO_LABEL}</strong>
                          <span className="search-result__score">{Math.round(result.score)}</span>
                        </span>
                        <span className="search-result__preview">{result.preview}</span>
                        <span className="search-result__meta">
                          <span>{formatMemoTimestamp(result.memo.updatedAt)}</span>
                          {result.matchedTerms.map((term) => (
                            <span key={`${result.memo.id}-${term}`} className="search-chip">
                              {term}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <h3>관련 메모가 없습니다</h3>
                  <p>사람, 주제, 상황 키워드로 다시 검색해 보세요. 첫 버전은 관련 메모 목록만 보여줍니다.</p>
                </div>
              )
            ) : (
              <div className="empty-state empty-state--compact">
                <h3>자연어로 검색해 보세요</h3>
                <p>예: “오늘 할 일”, “교수님께 보낼 메일”, “회의 메모 초안”</p>
              </div>
            )}
          </div>

          <div className="tool-card tool-card--accent">
            <p className="panel__kicker">AI 정리</p>
            <h2>막 적은 문장 다듬기</h2>
            <p>
              현재 선택한 메모에서 바로 문장을 다듬거나 공손한 문체로 바꾼 뒤, 마음에 들면 본문에 반영할 수 있습니다.
            </p>
            <div className="tool-tags">
              <span className="badge">문장 다듬기</span>
              <span className="badge">공손한 문체</span>
              <span className="badge">로컬 규칙 기반</span>
            </div>
          </div>

          <div className="tool-card tool-card--summary">
            <p className="panel__kicker">미리보기 정보</p>
            <h2>{runtimeDetail}</h2>
            <p>
              검색과 정리 모두 로컬에서 동작하는 미리보기 버전입니다. 나중에 실제 AI provider로 교체할 수 있도록 경계는 유지했습니다.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
