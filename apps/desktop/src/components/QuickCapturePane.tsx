import type { KeyboardEvent } from "react";
import { useQuickCaptureController } from "../hooks/useQuickCaptureController";
import { isMacOSPlatform } from "../infrastructure/desktop-window";
import { IconCheck, IconClose } from "./icons";

export function QuickCapturePane() {
  const { body, isSaving, textareaRef, setBody, saveAndClose, discardAndClose } = useQuickCaptureController();

  return (
    <main className="quick-capture-pane" data-testid="quick-capture-pane">
      <section className="quick-capture-card">
        <QuickCaptureHeader discardAndClose={discardAndClose} />
        <textarea
          ref={textareaRef}
          className="quick-capture-input"
          data-testid="quick-capture-input"
          value={body}
          placeholder="떠오른 생각을 적어보세요"
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => handleQuickCaptureKeyDown(event, { saveAndClose, discardAndClose })}
        />
        <QuickCaptureFooter body={body} isSaving={isSaving} saveAndClose={saveAndClose} />
      </section>
    </main>
  );
}

function QuickCaptureHeader({ discardAndClose }: { discardAndClose: () => Promise<void> }) {
  return (
    <header className="quick-capture-header" data-testid="quick-capture-header">
      <span className="quick-capture-title">빠른 메모</span>
      <button className="quick-capture-close-button" type="button" aria-label="닫기" title="닫기 (Esc)" onClick={() => void discardAndClose()}>
        <IconClose className="button-icon" />
        <span className="visually-hidden">닫기</span>
      </button>
    </header>
  );
}

function QuickCaptureFooter({
  body,
  isSaving,
  saveAndClose
}: {
  body: string;
  isSaving: boolean;
  saveAndClose: () => Promise<void>;
}) {
  return (
    <footer className="quick-capture-footer">
      <span className="quick-capture-hint">Esc 닫기 · {isMacOSPlatform() ? "⌘" : "Ctrl+"}Enter 저장</span>
      <button
        className="paper-button paper-button-primary quick-capture-save-button"
        type="button"
        data-testid="quick-capture-save-button"
        disabled={isSaving || body.trim().length === 0}
        onClick={() => void saveAndClose()}
      >
        <IconCheck className="button-icon" />
        저장
      </button>
    </footer>
  );
}

function handleQuickCaptureKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  { saveAndClose, discardAndClose }: { saveAndClose: () => Promise<void>; discardAndClose: () => Promise<void> }
) {
  if (event.key === "Escape") {
    event.preventDefault();
    void discardAndClose();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    void saveAndClose();
  }
}
