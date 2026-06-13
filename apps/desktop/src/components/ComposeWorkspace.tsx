import type { Dispatch, FormEvent, KeyboardEvent, RefObject, SetStateAction } from "react";
import type { ComposeSession } from "../domain/compose-session";

const composeSuggestions = [
  "오늘 해야 할 일을 체크리스트로 정리해줘",
  "회의 메모에서 결정사항과 다음 행동을 뽑아줘",
  "흩어진 아이디어를 하나의 기획 메모로 묶어줘"
];

type ComposeWorkspaceProps = {
  composePromptInputRef: RefObject<HTMLTextAreaElement>;
  composeSession: ComposeSession;
  isComposeAnimating: boolean;
  isComposeBusy: boolean;
  isComposeGenerating: boolean;
  notesCount: number;
  closeComposeSession: () => void;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
  startComposeDraft: () => Promise<void>;
};

export function ComposeWorkspace({
  composePromptInputRef,
  composeSession,
  isComposeAnimating,
  isComposeBusy,
  isComposeGenerating,
  notesCount,
  closeComposeSession,
  setComposeSession,
  startComposeDraft
}: ComposeWorkspaceProps) {
  return (
    <section className="compose-workspace" data-testid="compose-screen">
      <ComposeCanvas
        composeSession={composeSession}
        isComposeAnimating={isComposeAnimating}
        isComposeGenerating={isComposeGenerating}
        isComposeBusy={isComposeBusy}
        notesCount={notesCount}
        setComposeSession={setComposeSession}
      />
      <ComposePromptBar
        composePromptInputRef={composePromptInputRef}
        composeSession={composeSession}
        isComposeAnimating={isComposeAnimating}
        isComposeBusy={isComposeBusy}
        isComposeGenerating={isComposeGenerating}
        closeComposeSession={closeComposeSession}
        setComposeSession={setComposeSession}
        startComposeDraft={startComposeDraft}
      />
    </section>
  );
}

type ComposeCanvasProps = {
  composeSession: ComposeSession;
  isComposeAnimating: boolean;
  isComposeBusy: boolean;
  isComposeGenerating: boolean;
  notesCount: number;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
};

function ComposeCanvas({ composeSession, isComposeAnimating, isComposeBusy, isComposeGenerating, notesCount, setComposeSession }: ComposeCanvasProps) {
  return (
    <div className="compose-workspace__canvas">
      <ComposeIntro isComposeBusy={isComposeBusy} notesCount={notesCount} setComposeSession={setComposeSession} />
      <ComposeStatePanel composeSession={composeSession} isComposeAnimating={isComposeAnimating} isComposeGenerating={isComposeGenerating} />
    </div>
  );
}

function ComposeIntro({ isComposeBusy, notesCount, setComposeSession }: { isComposeBusy: boolean; notesCount: number; setComposeSession: Dispatch<SetStateAction<ComposeSession>> }) {
  return (
    <div className="compose-workspace__intro">
      <span className="compose-workspace__eyebrow">AI 메모 조합</span>
      <strong>흩어진 메모를 바로 쓸 수 있는 초안으로 묶습니다.</strong>
      <p>기존 메모를 기준으로 정리하고, 요청이 명확하면 오늘 할 일이나 다음 행동도 함께 제안합니다.</p>
      <ComposeMeta notesCount={notesCount} />
      <ComposeSuggestions isComposeBusy={isComposeBusy} setComposeSession={setComposeSession} />
    </div>
  );
}

function ComposeMeta({ notesCount }: { notesCount: number }) {
  return (
    <div className="compose-workspace__meta" data-testid="compose-screen-meta">
      <span className="compose-workspace__chip">관련 메모 기준</span>
      <span className="compose-workspace__chip">작성된 메모 {notesCount}개</span>
      <span className="compose-workspace__chip">Enter로 재구성</span>
    </div>
  );
}

function ComposeSuggestions({ isComposeBusy, setComposeSession }: { isComposeBusy: boolean; setComposeSession: Dispatch<SetStateAction<ComposeSession>> }) {
  return (
    <div className="compose-workspace__suggestions" aria-label="추천 프롬프트">
      {composeSuggestions.map((suggestion) => (
        <button key={suggestion} className="compose-workspace__suggestion" type="button" disabled={isComposeBusy} onClick={() => applyComposeSuggestion(suggestion, setComposeSession)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}

function applyComposeSuggestion(suggestion: string, setComposeSession: Dispatch<SetStateAction<ComposeSession>>) {
  setComposeSession((currentSession) => ({
    ...currentSession,
    prompt: suggestion,
    phase: currentSession.phase === "error" || currentSession.phase === "refused" ? "idle" : currentSession.phase,
    errorMessage: null,
    refusalReason: null
  }));
}

function ComposeStatePanel({ composeSession, isComposeAnimating, isComposeGenerating }: { composeSession: ComposeSession; isComposeAnimating: boolean; isComposeGenerating: boolean }) {
  if (isComposeAnimating) {
    return <ComposeResultPanel composeSession={composeSession} />;
  }

  if (isComposeGenerating) {
    return <ComposePlaceholder testId="compose-generating-state" title="관련 메모를 찾고 조합 가능 여부를 확인하고 있어요" text="근거가 충분할 때만 새 메모를 만들고, 근거가 부족하면 여기서 바로 멈춰요." />;
  }

  return <ComposeSettledPanel composeSession={composeSession} />;
}

function ComposeResultPanel({ composeSession }: { composeSession: ComposeSession }) {
  return (
    <article className="compose-workspace__result" data-testid="compose-result-panel">
      <div className="compose-workspace__result-head">
        <span className="compose-workspace__result-label">근거 기반 재구성 중</span>
        <strong>{composeSession.resultTitle || "관련 메모 재구성본"}</strong>
        <p>{composeSession.sourceCount}개의 관련 메모에서 확인된 내용만 타이핑하듯 채워 넣고 있어요.</p>
      </div>
      <pre className="compose-workspace__result-body" data-testid="compose-result-body">
        {composeSession.visibleBody}
        <span className="compose-workspace__caret" aria-hidden="true" />
      </pre>
    </article>
  );
}

function ComposeSettledPanel({ composeSession }: { composeSession: ComposeSession }) {
  if (composeSession.phase === "refused") {
    return <ComposeRefusalPanel composeSession={composeSession} />;
  }

  if (composeSession.phase === "error") {
    return <ComposePlaceholder error testId="compose-error-state" title="메모 조합을 끝내지 못했어요" text={composeSession.errorMessage ?? "프롬프트를 다듬어 다시 시도해 주세요."} />;
  }

  return <ComposePlaceholder testId="compose-idle-state" title="기존 메모 안에서만 다시 정리할 내용을 적어 주세요" text="할 일 목록, 회의 정리, 아이디어 묶기처럼 원하는 모양을 자유롭게 적어 주세요." />;
}

function ComposeRefusalPanel({ composeSession }: { composeSession: ComposeSession }) {
  const title = composeSession.refusalReason === "no_related_memos" ? "관련 메모를 찾지 못했어요" : "근거가 부족해 새 메모를 만들지 않았어요";

  return (
    <article className="compose-workspace__placeholder is-error" data-testid="compose-refusal-state">
      <strong>{title}</strong>
      <p>{composeSession.errorMessage ?? "프롬프트를 더 구체적으로 적거나 관련 메모를 더 남겨 주세요."}</p>
      <div className="compose-workspace__meta">
        <span className="compose-workspace__chip">관련 메모 {composeSession.relatedCount}개</span>
        <span className="compose-workspace__chip">새 메모 미생성</span>
      </div>
    </article>
  );
}

function ComposePlaceholder({ error = false, testId, title, text }: { error?: boolean; testId: string; title: string; text: string }) {
  return (
    <article className={`compose-workspace__placeholder${error ? " is-error" : ""}`} data-testid={testId}>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

type ComposePromptBarProps = {
  composePromptInputRef: RefObject<HTMLTextAreaElement>;
  composeSession: ComposeSession;
  isComposeAnimating: boolean;
  isComposeBusy: boolean;
  isComposeGenerating: boolean;
  closeComposeSession: () => void;
  setComposeSession: Dispatch<SetStateAction<ComposeSession>>;
  startComposeDraft: () => Promise<void>;
};

function ComposePromptBar({ composePromptInputRef, composeSession, isComposeAnimating, isComposeBusy, isComposeGenerating, closeComposeSession, setComposeSession, startComposeDraft }: ComposePromptBarProps) {
  return (
    <form className="compose-workspace__prompt-bar" data-testid="compose-prompt-bar" onSubmit={(event) => submitComposePrompt(event, startComposeDraft)}>
      <label className="compose-workspace__prompt-box">
        <span className="visually-hidden">AI 메모 조합 프롬프트</span>
        <textarea ref={composePromptInputRef} data-testid="compose-prompt-input" value={isComposeBusy ? composeSession.submittedPrompt : composeSession.prompt} disabled={isComposeBusy} placeholder="예: 오늘 해야 할 일을 기한 지난 항목은 빼고 체크리스트로 정리해줘" onChange={(event) => updateComposePrompt(event.target.value, setComposeSession)} onKeyDown={(event) => handleComposePromptKeyDown(event, startComposeDraft)} />
      </label>
      <div className="compose-workspace__prompt-actions">
        <button className="paper-button" type="button" onClick={closeComposeSession}>
          {isComposeAnimating ? "바로 보기" : "닫기"}
        </button>
        <button className={`paper-button paper-button-primary${isComposeGenerating ? " is-loading" : ""}`} type="submit" data-testid="submit-compose-button" disabled={isComposeBusy}>
          {isComposeGenerating ? "조합 중…" : "Enter로 메모 재구성"}
        </button>
      </div>
    </form>
  );
}

function submitComposePrompt(event: FormEvent<HTMLFormElement>, startComposeDraft: () => Promise<void>) {
  event.preventDefault();
  void startComposeDraft();
}

function updateComposePrompt(prompt: string, setComposeSession: Dispatch<SetStateAction<ComposeSession>>) {
  setComposeSession((currentSession) => ({
    ...currentSession,
    prompt,
    errorMessage: null,
    refusalReason: null,
    phase: currentSession.phase === "error" || currentSession.phase === "refused" ? "idle" : currentSession.phase
  }));
}

function handleComposePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, startComposeDraft: () => Promise<void>) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  void startComposeDraft();
}
