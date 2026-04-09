import { startTransition, useEffect, useState } from "react";
import type {
  Memo,
  MemoCreateInput,
  MemoOrganizeIntent,
  MemoOrganizeResult,
  MemoUpdateInput
} from "../shared/memo";

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
    title: overrides.title ?? "Untitled memo",
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
      title: "Today",
      body: "Call procurement after lunch.\nAsk for the revised timeline and keep the follow-up short.",
      createdAt: offset(90),
      updatedAt: offset(12)
    }),
    createFallbackMemo({
      title: "Professor email draft",
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
    return "No content yet";
  }

  return cleaned.length > 90 ? `${cleaned.slice(0, 90).trimEnd()}…` : cleaned;
}

function formatMemoTimestamp(iso: string) {
  const timestamp = new Date(iso);

  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
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
  return window.memoAPI ? "Connecting to local desktop store" : "Renderer preview";
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
          setStatusMessage(window.memoAPI ? "Local desktop store connected" : "Renderer preview seed");
          setErrorMessage(null);
          setIsLoading(false);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Failed to load memos.");
        setStatusMessage("Could not load local memos");
        setIsLoading(false);
      }
    }

    void hydrateMemos();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setOrganizeResult(null);
    setIsOrganizing(null);
  }, [activeMemoId]);

  const orderedMemos = sortMemosByRecency(memos);
  const activeMemo = orderedMemos.find((memo) => memo.id === activeMemoId) ?? orderedMemos[0] ?? null;
  const runtimeLabel = window.desktopAPI ? formatPlatform(window.desktopAPI.platform) : "Browser";
  const runtimeDetail = window.desktopAPI
    ? `${window.desktopAPI.versions.electron} / ${window.desktopAPI.versions.chrome}`
    : "No preload bridge";

  function replaceMemo(nextMemo: Memo) {
    setMemos((current) => [nextMemo, ...current.filter((memo) => memo.id !== nextMemo.id)]);
  }

  async function createMemo() {
    const input: MemoCreateInput = {
      title: "Untitled memo",
      body: ""
    };

    try {
      const nextMemo = window.memoAPI ? await window.memoAPI.create(input) : createFallbackMemo(input);

      replaceMemo(nextMemo);
      setActiveMemoId(nextMemo.id);
      setStatusMessage(window.memoAPI ? "Saved to local desktop store" : "Created in renderer preview");
      setErrorMessage(null);
      setOrganizeResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create memo.");
      setStatusMessage("Create failed");
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
    setStatusMessage(window.memoAPI ? "Saving to local desktop store..." : "Renderer preview only");
    setErrorMessage(null);
    setOrganizeResult(null);

    void persistMemoUpdate(activeMemo.id, { [field]: value }).then(
      (persisted) => {
        if (persisted) {
          replaceMemo(persisted);
        }

        setStatusMessage(window.memoAPI ? "Saved to local desktop store" : "Renderer preview only");
      },
      (error) => {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update memo.");
        setStatusMessage("Save failed");
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
        throw new Error("The selected memo could not be deleted.");
      }

      setMemos((current) => current.filter((memo) => memo.id !== activeMemo.id));
      setActiveMemoId(fallback?.id ?? null);
      setStatusMessage(window.memoAPI ? "Deleted from local desktop store" : "Removed in renderer preview");
      setErrorMessage(null);
      setOrganizeResult(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete memo.");
      setStatusMessage("Delete failed");
    }
  }

  async function runOrganize(intent: MemoOrganizeIntent) {
    if (!activeMemo || !window.memoAPI) {
      return;
    }

    setIsOrganizing(intent);
    setErrorMessage(null);
    setStatusMessage(intent === "polite" ? "Converting tone..." : "Polishing draft...");

    try {
      const result = await window.memoAPI.organize({
        memoId: activeMemo.id,
        title: activeMemo.title,
        body: activeMemo.body,
        intent
      });

      setOrganizeResult(result);
      setStatusMessage(result.summary);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to organize memo.");
      setStatusMessage("Organize failed");
    } finally {
      setIsOrganizing(null);
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

      if (persisted) {
        replaceMemo(persisted);
      }

      setOrganizeResult(null);
      setStatusMessage("Applied organized draft to memo");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply suggestion.");
      setStatusMessage("Apply failed");
    } finally {
      setIsApplyingSuggestion(false);
    }
  }

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div className="workspace__brand">
          <p className="workspace__eyebrow">Desktop memo workspace</p>
          <h1>AI Note</h1>
          <p className="workspace__lede">
            Capture quickly, store locally, and use a deterministic organize pass to clean rough
            text before search lands.
          </p>
        </div>

        <div className="workspace__status">
          <span className="badge badge--soft">{runtimeLabel}</span>
          <span className="badge">{statusMessage}</span>
          <span className="badge">{orderedMemos.length} memos</span>
        </div>
      </header>

      <section className="workspace__shell">
        <aside className="panel panel--sidebar">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Memo library</p>
              <h2>Recent memos</h2>
            </div>
            <button className="button button--primary" type="button" onClick={() => void createMemo()}>
              + New memo
            </button>
          </div>

          <div className="memo-list" role="list" aria-label="Memo list">
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
                    <strong>{memo.title || "Untitled memo"}</strong>
                    <span className="memo-card__date">{formatMemoTimestamp(memo.updatedAt)}</span>
                  </span>
                  <span className="memo-card__preview">{getMemoPreview(memo.body)}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel panel--editor" aria-label="Memo editor">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Editor</p>
              <h2>{activeMemo ? "Write and refine" : "Create your first memo"}</h2>
            </div>

            <div className="panel__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void deleteActiveMemo()}
                disabled={!activeMemo}
              >
                Delete
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void runOrganize("polish")}
                disabled={!activeMemo || !window.memoAPI || isOrganizing !== null}
              >
                {isOrganizing === "polish" ? "Polishing..." : "Polish"}
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void runOrganize("polite")}
                disabled={!activeMemo || !window.memoAPI || isOrganizing !== null}
              >
                {isOrganizing === "polite" ? "Rewriting..." : "Make polite"}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <h3>Loading memos</h3>
              <p>Preparing the local desktop store.</p>
            </div>
          ) : activeMemo ? (
            <div className="editor">
              <label className="field">
                <span className="field__label">Title</span>
                <input
                  className="input"
                  type="text"
                  value={activeMemo.title}
                  onChange={(event) => updateActiveMemo("title", event.target.value)}
                  placeholder="Memo title"
                />
              </label>

              <label className="field field--grow">
                <span className="field__label">Body</span>
                <textarea
                  className="textarea"
                  value={activeMemo.body}
                  onChange={(event) => updateActiveMemo("body", event.target.value)}
                  placeholder="Write a note, rough idea, or meeting capture..."
                />
              </label>

              {organizeResult ? (
                <section className="organize-preview" aria-label="AI organize preview">
                  <div className="organize-preview__header">
                    <div>
                      <p className="panel__kicker">Organize preview</p>
                      <h3>{organizeResult.intent === "polite" ? "Polite tone" : "Sentence polish"}</h3>
                    </div>
                    <div className="panel__actions">
                      <button
                        className="button button--primary"
                        type="button"
                        onClick={() => void applyOrganizeSuggestion()}
                        disabled={isApplyingSuggestion || organizeResult.suggested.length === 0}
                      >
                        {isApplyingSuggestion ? "Applying..." : "Apply suggestion"}
                      </button>
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => setOrganizeResult(null)}
                        disabled={isApplyingSuggestion}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  <p className="organize-preview__summary">{organizeResult.summary}</p>

                  <div className="organize-preview__grid">
                    <div className="organize-preview__panel">
                      <span className="field__label">Original</span>
                      <pre>{organizeResult.original || "No content to organize."}</pre>
                    </div>
                    <div className="organize-preview__panel organize-preview__panel--accent">
                      <span className="field__label">Suggested</span>
                      <pre>{organizeResult.suggested || "Organizer could not improve blank content."}</pre>
                    </div>
                  </div>
                </section>
              ) : null}

              <div className="editor__meta">
                <span>Created {formatMemoTimestamp(activeMemo.createdAt)}</span>
                <span>Updated {formatMemoTimestamp(activeMemo.updatedAt)}</span>
                <span>{window.memoAPI ? "Desktop memo API connected" : "Renderer preview only"}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No memo selected</h3>
              <p>
                Start with a quick note. The current desktop flow stores memos locally and can now
                preview a polished or polite rewrite for the active draft.
              </p>
              <button className="button button--primary" type="button" onClick={() => void createMemo()}>
                + Create memo
              </button>
            </div>
          )}

          {errorMessage ? <p className="inline-error">{errorMessage}</p> : null}
        </section>

        <aside className="panel panel--tools">
          <div className="tool-card">
            <p className="panel__kicker">Context search</p>
            <h2>Find by meaning</h2>
            <p>
              The next cycle will let you search memos by natural phrasing and return a related list.
            </p>
            <div className="placeholder-input" aria-hidden="true">
              Search memos with AI
            </div>
            <button className="button button--ghost" type="button" disabled>
              AI search coming soon
            </button>
          </div>

          <div className="tool-card tool-card--accent">
            <p className="panel__kicker">Organize</p>
            <h2>Active memo only</h2>
            <p>
              Run a deterministic local organize pass for sentence polish or polite tone, then apply
              the suggested body when it looks right.
            </p>
            <div className="tool-tags">
              <span className="badge">Polish</span>
              <span className="badge">Polite tone</span>
              <span className="badge">Local only</span>
            </div>
          </div>

          <div className="tool-card tool-card--summary">
            <p className="panel__kicker">Build note</p>
            <h2>{runtimeDetail}</h2>
            <p>
              The organize service is deterministic and local today, but the Electron boundary is now
              shaped so a real provider can replace it later.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
