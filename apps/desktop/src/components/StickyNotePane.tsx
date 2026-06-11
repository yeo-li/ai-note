import type { RefObject } from "react";
import type { Note } from "../domain/note";
import { PlusIcon, StickyCloseIcon, StickyPinIcon } from "./icons";

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
  return (
    <div className="sticky-note-canvas">
      <article className="sticky-note-card">
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
        <NewStickyButton {...props} />
      </div>
    </div>
  );
}

function CloseStickyButton({ closeStickySurface, isDedicatedStickyWindow }: StickyNotePaneProps) {
  return (
    <button className="sticky-note-toolbar__button sticky-note-toolbar__button--close" type="button" data-testid="sticky-mode-exit-button" aria-label={isDedicatedStickyWindow ? "스티커 창 닫기" : "일반 모드로 돌아가기"} onClick={closeStickySurface}>
      <StickyCloseIcon />
    </button>
  );
}

function PinStickyButton({ isStickyPinned, toggleStickyPinned }: StickyNotePaneProps) {
  return (
    <button className={`sticky-note-toolbar__button sticky-note-toolbar__button--pin${isStickyPinned ? " is-pinned" : ""}`} type="button" data-testid="sticky-mode-pin-button" aria-label={isStickyPinned ? "스티커 메모 고정 해제" : "스티커 메모 고정"} aria-pressed={isStickyPinned} onClick={() => void toggleStickyPinned()}>
      <StickyPinIcon />
    </button>
  );
}

function NewStickyButton({ handleCreateStickyNoteWindow, isMutationLocked }: StickyNotePaneProps) {
  return (
    <button className="sticky-note-toolbar__button sticky-note-toolbar__button--new" type="button" data-testid="sticky-mode-new-note-button" aria-label="새 스티커 메모 만들기" disabled={isMutationLocked} onClick={() => void handleCreateStickyNoteWindow()}>
      <PlusIcon />
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
      <p>왼쪽 위 + 버튼으로 새 스티커 메모를 추가해 주세요.</p>
    </section>
  );
}
