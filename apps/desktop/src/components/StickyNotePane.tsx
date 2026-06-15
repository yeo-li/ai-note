import { useState, type RefObject } from "react";
import type { MemoStickyColor } from "@ai-note/shared/memo";
import { MEMO_STICKY_COLORS } from "@ai-note/shared/memo";
import { IconCheck, IconClose, IconPalette, IconPin, IconPlus } from "./icons";
import type { Note } from "../domain/note";

const STICKY_COLOR_LABELS: Record<MemoStickyColor, string> = {
  yellow: "노란색",
  pink: "분홍색",
  blue: "파란색",
  green: "초록색",
  purple: "보라색"
};

type StickyNotePaneProps = {
  activeNote: Note | null;
  hasBackup: boolean;
  isDedicatedStickyWindow: boolean;
  isEditorLocked: boolean;
  isMutationLocked: boolean;
  isStickyPinned: boolean;
  noteBodyInputRef: RefObject<HTMLTextAreaElement>;
  closeStickySurface: () => void;
  handleCreateStickyNoteWindow: () => Promise<void>;
  patchActiveNote: (update: Partial<Note>, message?: string) => void;
  toggleStickyPinned: () => Promise<void>;
};

export function StickyNotePane(props: StickyNotePaneProps) {
  const colorClassName = props.activeNote?.color ? ` sticky-note-card--${props.activeNote.color}` : "";

  return (
    <div className="sticky-note-canvas">
      <article className={`sticky-note-card${colorClassName}`}>
        <StickyToolbar {...props} />
        <StickyBody {...props} />
      </article>
    </div>
  );
}

function StickyToolbar(props: StickyNotePaneProps) {
  return (
    <div className="sticky-note-toolbar" role="toolbar" aria-label="스티커 메모 도구" data-testid="sticky-toolbar">
      <div className="sticky-note-toolbar__actions sticky-note-toolbar__actions--left">
        <CloseStickyButton {...props} />
      </div>
      <div className="sticky-note-toolbar__actions sticky-note-toolbar__actions--right">
        <PinStickyButton {...props} />
        <StickyColorPickerButton {...props} />
        <NewStickyButton {...props} />
      </div>
    </div>
  );
}

function CloseStickyButton({ closeStickySurface, isDedicatedStickyWindow }: StickyNotePaneProps) {
  const label = isDedicatedStickyWindow ? "스티커 창 닫기" : "일반 모드로 돌아가기";

  return (
    <button className="sticky-note-toolbar__button sticky-note-toolbar__button--close" type="button" data-testid="sticky-mode-exit-button" aria-label={label} title={label} onClick={closeStickySurface}>
      <IconClose className="button-icon" />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}

function PinStickyButton({ isStickyPinned, toggleStickyPinned }: StickyNotePaneProps) {
  const label = isStickyPinned ? "스티커 메모 고정 해제" : "스티커 메모 고정";

  return (
    <button className={`sticky-note-toolbar__button sticky-note-toolbar__button--pin${isStickyPinned ? " is-pinned" : ""}`} type="button" data-testid="sticky-mode-pin-button" aria-label={label} title={label} aria-pressed={isStickyPinned} onClick={() => void toggleStickyPinned()}>
      <IconPin className="button-icon" />
      <span className="visually-hidden">{label}</span>
    </button>
  );
}

function StickyColorPickerButton({ activeNote, patchActiveNote }: StickyNotePaneProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!activeNote) {
    return null;
  }

  function selectColor(color: MemoStickyColor) {
    const nextColor = activeNote?.color === color ? null : color;
    patchActiveNote({ color: nextColor }, "스티커 메모 색상을 변경했다.");
    setIsOpen(false);
  }

  return (
    <div className="sticky-note-color-picker">
      <button
        className="sticky-note-toolbar__button sticky-note-toolbar__button--color"
        type="button"
        data-testid="sticky-mode-color-button"
        aria-label="스티커 메모 색상 변경"
        title="스티커 메모 색상 변경"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <IconPalette className="button-icon" />
        <span className="visually-hidden">스티커 메모 색상 변경</span>
      </button>
      {isOpen ? (
        <div className="sticky-note-color-picker__popover" role="menu" aria-label="스티커 메모 색상 선택" data-testid="sticky-color-popover">
          {MEMO_STICKY_COLORS.map((color) => (
            <button
              key={color}
              className={`sticky-note-color-swatch sticky-note-color-swatch--${color}`}
              type="button"
              role="menuitemradio"
              aria-checked={activeNote.color === color}
              aria-label={STICKY_COLOR_LABELS[color]}
              title={STICKY_COLOR_LABELS[color]}
              data-testid={`sticky-color-swatch-${color}`}
              onClick={() => selectColor(color)}
            >
              {activeNote.color === color ? <IconCheck className="sticky-note-color-swatch__check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NewStickyButton({ handleCreateStickyNoteWindow, isMutationLocked }: StickyNotePaneProps) {
  return (
    <button className="sticky-note-toolbar__button sticky-note-toolbar__button--new" type="button" data-testid="sticky-mode-new-note-button" aria-label="새 스티커 메모 만들기" title="새 스티커 메모 만들기" disabled={isMutationLocked} onClick={() => void handleCreateStickyNoteWindow()}>
      <IconPlus className="button-icon" />
      <span className="visually-hidden">새 스티커 메모 만들기</span>
    </button>
  );
}

function StickyBody(props: StickyNotePaneProps) {
  if (!props.activeNote) {
    return <StickyEmptyState />;
  }

  return (
    <div className="sticky-note-body">
      <label className="editor-field editor-field-body sticky-note-field">
        <textarea className="paper-editor sticky-note-editor" data-testid="note-body-input" ref={props.noteBodyInputRef} value={props.activeNote.body} placeholder="여기에 메모를 적어 주세요." disabled={props.isEditorLocked} readOnly={props.isEditorLocked} onChange={(event) => patchStickyBody(event.target.value, props)} />
      </label>
    </div>
  );
}

function patchStickyBody(body: string, props: StickyNotePaneProps) {
  props.patchActiveNote(
    {
      body,
      mode: props.hasBackup && props.activeNote ? props.activeNote.mode : "default"
    },
    "메모 내용을 수정했다."
  );
}

function StickyEmptyState() {
  return (
    <section className="sticky-note-empty" data-testid="editor-empty-state">
      <strong>메모가 없어요</strong>
      <p>새 메모 버튼으로 스티커 메모를 추가해 주세요.</p>
    </section>
  );
}
