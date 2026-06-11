import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { deriveNoteHeadline } from "../note-content";
import { aiChatSuggestions } from "../domain/ai-chat";
import type { AiChatMessage } from "../domain/ai-chat";
import type { Note } from "../domain/note";
import type { AiChatInputHandler, MemoIdHandler } from "./component-types";

type AiChatPanelProps = {
  activeNote: Note | null;
  aiChatInput: string;
  aiChatInputRef: RefObject<HTMLTextAreaElement>;
  aiChatMessages: AiChatMessage[];
  aiChatThreadRef: RefObject<HTMLDivElement>;
  isAiChatThinking: boolean;
  closeAiChatPanel: () => void;
  openNoteFromAiChat: MemoIdHandler;
  setAiChatInput: AiChatInputHandler;
  submitAiChatPrompt: (promptOverride?: string) => Promise<void>;
};

export function AiChatPanel({
  activeNote,
  aiChatInput,
  aiChatInputRef,
  aiChatMessages,
  aiChatThreadRef,
  isAiChatThinking,
  closeAiChatPanel,
  openNoteFromAiChat,
  setAiChatInput,
  submitAiChatPrompt
}: AiChatPanelProps) {
  return (
    <aside className="ai-chat-panel" data-testid="ai-chat-panel" aria-label="AI 채팅">
      <AiChatHeader closeAiChatPanel={closeAiChatPanel} />
      <AiChatThread
        activeNote={activeNote}
        aiChatMessages={aiChatMessages}
        aiChatThreadRef={aiChatThreadRef}
        isAiChatThinking={isAiChatThinking}
        openNoteFromAiChat={openNoteFromAiChat}
      />
      <AiChatSuggestions isAiChatThinking={isAiChatThinking} submitAiChatPrompt={submitAiChatPrompt} />
      <AiChatComposer
        aiChatInput={aiChatInput}
        aiChatInputRef={aiChatInputRef}
        isAiChatThinking={isAiChatThinking}
        setAiChatInput={setAiChatInput}
        submitAiChatPrompt={submitAiChatPrompt}
      />
    </aside>
  );
}

function AiChatHeader({ closeAiChatPanel }: { closeAiChatPanel: () => void }) {
  return (
    <header className="ai-chat-header">
      <div>
        <span className="ai-chat-kicker">AI Chat</span>
        <strong>메모와 대화하기</strong>
      </div>
      <button className="paper-button paper-button-icon" type="button" data-testid="close-ai-chat-button" aria-label="AI 채팅 닫기" onClick={closeAiChatPanel}>
        닫기
      </button>
    </header>
  );
}

type AiChatThreadProps = {
  activeNote: Note | null;
  aiChatMessages: AiChatMessage[];
  aiChatThreadRef: RefObject<HTMLDivElement>;
  isAiChatThinking: boolean;
  openNoteFromAiChat: MemoIdHandler;
};

function AiChatThread({ activeNote, aiChatMessages, aiChatThreadRef, isAiChatThinking, openNoteFromAiChat }: AiChatThreadProps) {
  return (
    <div className="ai-chat-thread" data-testid="ai-chat-thread" ref={aiChatThreadRef}>
      {aiChatMessages.map((message) => (
        <AiChatMessageCard key={message.id} activeNote={activeNote} message={message} openNoteFromAiChat={openNoteFromAiChat} />
      ))}
      {isAiChatThinking ? <AiChatThinking /> : null}
    </div>
  );
}

function AiChatThinking() {
  return (
    <div className="ai-chat-thinking" data-testid="ai-chat-thinking-state">
      <span />
      <strong>요청을 이해하고 있어요</strong>
    </div>
  );
}

type AiChatMessageCardProps = {
  activeNote: Note | null;
  message: AiChatMessage;
  openNoteFromAiChat: MemoIdHandler;
};

function AiChatMessageCard({ activeNote, message, openNoteFromAiChat }: AiChatMessageCardProps) {
  return (
    <article className={`ai-chat-message ai-chat-message--${message.role} ai-chat-message--${message.kind}`} data-testid={`ai-chat-message-${message.kind}`}>
      {message.role === "user" ? <p>{message.text}</p> : <AssistantMessage activeNote={activeNote} message={message} openNoteFromAiChat={openNoteFromAiChat} />}
    </article>
  );
}

type AssistantMessage = Exclude<AiChatMessage, { role: "user" }>;

function AssistantMessage({ activeNote, message, openNoteFromAiChat }: { activeNote: Note | null; message: AssistantMessage; openNoteFromAiChat: MemoIdHandler }) {
  if (message.kind === "search-results") {
    return <SearchResultsMessage activeNote={activeNote} message={message} openNoteFromAiChat={openNoteFromAiChat} />;
  }

  if (message.kind === "summary") {
    return <SummaryMessage message={message} openNoteFromAiChat={openNoteFromAiChat} />;
  }

  if (message.kind === "created-note") {
    return <CreatedNoteMessage message={message} openNoteFromAiChat={openNoteFromAiChat} />;
  }

  return <TextMessage message={message} />;
}

type SearchResultsMessage = Extract<AssistantMessage, { kind: "search-results" }>;

function SearchResultsMessage({ activeNote, message, openNoteFromAiChat }: { activeNote: Note | null; message: SearchResultsMessage; openNoteFromAiChat: MemoIdHandler }) {
  return (
    <>
      <MessageHead label="관련 메모" title={message.title} />
      <div className="ai-chat-result-list" data-testid="ai-chat-search-results">
        {message.results.map((result) => (
          <button key={result.memo.id} className={`ai-chat-result-card${activeNote?.id === result.memo.id ? " is-selected" : ""}`} type="button" data-testid={`ai-chat-result-open-${result.memo.id}`} onClick={() => openNoteFromAiChat(result.memo.id)}>
            <span className="ai-chat-result-card__title">{deriveNoteHeadline(result.memo.body)}</span>
            <span className="ai-chat-result-card__preview">{result.preview || result.reason}</span>
            <span className="ai-chat-result-card__reason">{result.reason}</span>
          </button>
        ))}
      </div>
    </>
  );
}

type SummaryMessage = Extract<AssistantMessage, { kind: "summary" }>;

function SummaryMessage({ message, openNoteFromAiChat }: { message: SummaryMessage; openNoteFromAiChat: MemoIdHandler }) {
  return (
    <>
      <MessageHead label="요약" title={message.title} />
      <pre className="ai-chat-summary" data-testid="ai-chat-summary-card">{message.summary}</pre>
      <div className="ai-chat-source-row">
        {message.results.slice(0, 3).map((result) => (
          <button key={result.memo.id} className="ai-chat-source-chip" type="button" data-testid={`ai-chat-summary-open-${result.memo.id}`} onClick={() => openNoteFromAiChat(result.memo.id)}>
            {deriveNoteHeadline(result.memo.body)}
          </button>
        ))}
      </div>
    </>
  );
}

type CreatedNoteMessage = Extract<AssistantMessage, { kind: "created-note" }>;

function CreatedNoteMessage({ message, openNoteFromAiChat }: { message: CreatedNoteMessage; openNoteFromAiChat: MemoIdHandler }) {
  return (
    <>
      <MessageHead label="새 메모" title={message.title} />
      <p data-testid="ai-chat-created-note">관련 메모 {message.relatedCount}개 중 {message.sourceCount}개를 근거로 새 메모를 만들었어요.</p>
      <pre className="ai-chat-created-preview">{message.body}</pre>
      <button className="paper-button paper-button-primary" type="button" data-testid="ai-chat-open-created-note-button" onClick={() => openNoteFromAiChat(message.noteId)}>
        새 메모 열기
      </button>
    </>
  );
}

type TextMessage = Extract<AssistantMessage, { kind: "welcome" | "text" | "error" }>;

function TextMessage({ message }: { message: TextMessage }) {
  return (
    <>
      <MessageHead label={message.kind === "error" ? "상태" : "안내"} title={message.title} />
      <p>{message.text}</p>
    </>
  );
}

function MessageHead({ label, title }: { label: string; title: string }) {
  return (
    <div className="ai-chat-message-head">
      <span>{label}</span>
      <strong>{title}</strong>
    </div>
  );
}

function AiChatSuggestions({ isAiChatThinking, submitAiChatPrompt }: { isAiChatThinking: boolean; submitAiChatPrompt: (promptOverride?: string) => Promise<void> }) {
  return (
    <div className="ai-chat-suggestions" aria-label="추천 요청">
      {aiChatSuggestions.map((suggestion) => (
        <button key={suggestion} className="ai-chat-suggestion" type="button" disabled={isAiChatThinking} onClick={() => void submitAiChatPrompt(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}

type AiChatComposerProps = {
  aiChatInput: string;
  aiChatInputRef: RefObject<HTMLTextAreaElement>;
  isAiChatThinking: boolean;
  setAiChatInput: AiChatInputHandler;
  submitAiChatPrompt: (promptOverride?: string) => Promise<void>;
};

function AiChatComposer({ aiChatInput, aiChatInputRef, isAiChatThinking, setAiChatInput, submitAiChatPrompt }: AiChatComposerProps) {
  return (
    <form className="ai-chat-composer" data-testid="ai-chat-form" onSubmit={(event) => submitAiChatForm(event, submitAiChatPrompt)}>
      <label>
        <span className="visually-hidden">AI 채팅 입력</span>
        <textarea ref={aiChatInputRef} data-testid="ai-chat-input" value={aiChatInput} disabled={isAiChatThinking} placeholder="예: 계약 일정 관련 메모 찾아줘" onChange={(event) => setAiChatInput(event.target.value)} onKeyDown={(event) => handleAiChatKeyDown(event, submitAiChatPrompt)} />
      </label>
      <button className={`paper-button paper-button-primary${isAiChatThinking ? " is-loading" : ""}`} type="submit" data-testid="submit-ai-chat-button" disabled={isAiChatThinking || aiChatInput.trim().length === 0}>
        보내기
      </button>
    </form>
  );
}

function submitAiChatForm(event: FormEvent<HTMLFormElement>, submitAiChatPrompt: (promptOverride?: string) => Promise<void>) {
  event.preventDefault();
  void submitAiChatPrompt();
}

function handleAiChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, submitAiChatPrompt: (promptOverride?: string) => Promise<void>) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  void submitAiChatPrompt();
}
