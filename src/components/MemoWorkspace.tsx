import { useMemo, useState } from "react";
import {
  createMemo,
  formatMemoTimestamp,
  getMemoPreview,
  getMemoSeed,
  sortMemosByRecency,
  type Memo
} from "./memoTypes";

type DesktopAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};

const platformName: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux"
};

const desktopAPI = window.desktopAPI as DesktopAPI | undefined;
const starterMemos = getMemoSeed();

const formatPlatform = (platform: string) => platformName[platform] ?? platform;

export function MemoWorkspace() {
  const [memos, setMemos] = useState<Memo[]>(() => starterMemos);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(
    () => starterMemos[0]?.id ?? null
  );

  const orderedMemos = useMemo(() => sortMemosByRecency(memos), [memos]);
  const activeMemo = orderedMemos.find((memo) => memo.id === activeMemoId) ?? orderedMemos[0] ?? null;

  const createNewMemo = () => {
    const nextMemo = createMemo({
      title: "Untitled memo",
      body: "Start typing here."
    });

    setMemos((current) => [nextMemo, ...current]);
    setActiveMemoId(nextMemo.id);
  };

  const updateActiveMemo = (field: keyof Pick<Memo, "title" | "body">, value: string) => {
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
  };

  const deleteActiveMemo = () => {
    if (!activeMemo) {
      return;
    }

    const activeIndex = orderedMemos.findIndex((memo) => memo.id === activeMemo.id);
    const remaining = memos.filter((memo) => memo.id !== activeMemo.id);
    const fallback = orderedMemos[activeIndex + 1] ?? orderedMemos[activeIndex - 1] ?? remaining[0] ?? null;

    setMemos(remaining);
    setActiveMemoId(fallback?.id ?? null);
  };

  const memoCount = orderedMemos.length;
  const runtimeLabel = desktopAPI ? formatPlatform(desktopAPI.platform) : "Renderer preview";
  const runtimeDetail = desktopAPI
    ? `${desktopAPI.versions.electron} / ${desktopAPI.versions.chrome}`
    : "In-memory memo workspace";

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div className="workspace__brand">
          <p className="workspace__eyebrow">Desktop memo workspace</p>
          <h1>AI Note</h1>
          <p className="workspace__lede">
            Fast capture now. AI organize and context search later. This sprint keeps the renderer
            ready for IPC without wiring the backend yet.
          </p>
        </div>

        <div className="workspace__status">
          <span className="badge badge--soft">{runtimeLabel}</span>
          <span className="badge">Renderer state only</span>
          <span className="badge">{memoCount} memos</span>
        </div>
      </header>

      <section className="workspace__shell">
        <aside className="panel panel--sidebar">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Memo library</p>
              <h2>Recent memos</h2>
            </div>
            <button className="button button--primary" type="button" onClick={createNewMemo}>
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
                    <strong>{memo.title}</strong>
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
                onClick={deleteActiveMemo}
                disabled={!activeMemo}
              >
                Delete
              </button>
              <button className="button button--ghost" type="button" disabled>
                AI organize
              </button>
            </div>
          </div>

          {activeMemo ? (
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
                <span>Selection-ready for IPC later</span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No memo selected</h3>
              <p>
                Start with a quick note. This workspace keeps memo state in the renderer for now,
                so the UI can be wired to local storage or IPC in the next sprint.
              </p>
              <button className="button button--primary" type="button" onClick={createNewMemo}>
                + Create memo
              </button>
            </div>
          )}
        </section>

        <aside className="panel panel--tools">
          <div className="tool-card">
            <p className="panel__kicker">Context search</p>
            <h2>Find by meaning</h2>
            <p>
              Search across all memos and return the relevant list later, not just the exact title.
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
              Later this slot will rewrite fragments, convert tone, and generate helpful titles.
            </p>
            <div className="tool-tags">
              <span className="badge">Rewrite</span>
              <span className="badge">Polish tone</span>
              <span className="badge">Auto-title</span>
            </div>
            <button className="button button--ghost" type="button" disabled>
              Organize later
            </button>
          </div>

          <div className="tool-card tool-card--summary">
            <p className="panel__kicker">Build note</p>
            <h2>{runtimeDetail}</h2>
            <p>
              The current implementation is intentionally in-memory only so the UI can move fast
              before the repository layer lands.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
