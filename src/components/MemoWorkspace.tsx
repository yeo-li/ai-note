import { startTransition, useEffect, useState } from "react";
import type { Memo, MemoCreateInput, MemoUpdateInput } from "../shared/memo";

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

  const orderedMemos = sortMemosByRecency(memos);
  const activeMemo = orderedMemos.find((memo) => memo.id === activeMemoId) ?? orderedMemos[0] ?? null;
  const runtimeLabel = window.desktopAPI ? formatPlatform(window.desktopAPI.platform) : "Browser";
  const runtimeDetail = window.desktopAPI
    ? `${window.desktopAPI.versions.electron} / ${window.desktopAPI.versions.chrome}`
    : "No preload bridge";

  async function createMemo() {
    const input: MemoCreateInput = {
      title: "Untitled memo",
      body: ""
    };

    try {
      const nextMemo = window.memoAPI ? await window.memoAPI.create(input) : createFallbackMemo(input);

      setMemos((current) => [nextMemo, ...current.filter((memo) => memo.id !== nextMemo.id)]);
      setActiveMemoId(nextMemo.id);
      setStatusMessage(window.memoAPI ? "Saved to local desktop store" : "Created in renderer preview");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create memo.");
      setStatusMessage("Create failed");
    }
  }

  async function persistMemoUpdate(memoId: string, updates: MemoUpdateInput) {
    if (!window.memoAPI) {
      return;
    }

    const persisted = await window.memoAPI.update(memoId, updates);

    if (!persisted) {
      throw new Error("The selected memo no longer exists.");
    }

    setMemos((current) =>
      current.map((memo) => (memo.id === persisted.id ? persisted : memo))
    );
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

    void persistMemoUpdate(activeMemo.id, { [field]: value }).then(
      () => {
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete memo.");
      setStatusMessage("Delete failed");
    }
  }

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div className="workspace__brand">
          <p className="workspace__eyebrow">Desktop memo workspace</p>
          <h1>AI Note</h1>
          <p className="workspace__lede">
            Capture quickly, store locally, and prepare the editor for AI organize and context
            search. Sprint 1 keeps the desktop memo loop concrete before smarter retrieval lands.
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
              <button className="button button--ghost" type="button" disabled={!activeMemo}>
                AI organize
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
                Start with a quick note. Sprint 1 already stores CRUD changes locally through the
                desktop bridge, and later iterations will layer AI organize and context search on top.
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
            <h2>Polish rough drafts</h2>
            <p>
              This slot will rewrite fragments, convert tone, and prepare cleaner text without leaving the app.
            </p>
            <div className="tool-tags">
              <span className="badge">Rewrite</span>
              <span className="badge">Polish tone</span>
              <span className="badge">Auto-title later</span>
            </div>
            <button className="button button--ghost" type="button" disabled>
              Organize later
            </button>
          </div>

          <div className="tool-card tool-card--summary">
            <p className="panel__kicker">Build note</p>
            <h2>{runtimeDetail}</h2>
            <p>
              The desktop shell is now wired to a local memo store. Search and AI organize can build on this foundation next.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
