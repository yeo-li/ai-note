import { useLayoutEffect, useMemo, useRef, type ChangeEvent, type KeyboardEvent, type RefObject, type UIEvent } from "react";
import {
  formatMemoCheckboxLine,
  hasMemoCheckboxSyntax,
  parseMemoCheckboxLine,
  toggleMemoCheckboxLine
} from "@ai-note/shared/memo";

type NoteBodyEditorProps = {
  body: string;
  isLocked: boolean;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  fieldClassName: string;
  textareaClassName: string;
  rendererClassName?: string;
  onChange: (body: string) => void;
};

type EditableLine = {
  index: number;
  line: string;
  lineStart: number;
};

type BodyLineRange = {
  start: number;
  end: number;
  line: string;
};

type PendingSelection = {
  start: number;
  end: number;
};

type ParsedMemoCheckboxLine = NonNullable<ReturnType<typeof parseMemoCheckboxLine>>;

const CHECKBOX_EDITOR_MARKER_LENGTH = 6;
const CHECKBOX_EDITOR_MARKER_UNCHECKED = "\u00a0     ";
const CHECKBOX_EDITOR_MARKER_CHECKED = "\u00a0\u00a0    ";

export function NoteBodyEditor({
  body,
  fieldClassName,
  isLocked,
  onChange,
  placeholder,
  rendererClassName = "",
  textareaClassName,
  textareaRef
}: NoteBodyEditorProps) {
  const hasCheckboxes = hasMemoCheckboxSyntax(body);
  const lines = useMemo(() => buildEditableLines(body), [body]);
  const editorBody = useMemo(() => toCheckboxEditorText(body), [body]);
  const rendererRef = useRef<HTMLDivElement | null>(null);
  const pendingSelectionRef = useRef<PendingSelection | null>(null);

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;

    if (!pendingSelection) {
      return;
    }

    pendingSelectionRef.current = null;
    restoreTextareaSelection(textareaRef.current, rendererRef.current, pendingSelection);
  }, [body, textareaRef]);

  if (!hasCheckboxes) {
    return (
      <label className={fieldClassName}>
        <textarea
          className={textareaClassName}
          data-testid="note-body-input"
          ref={textareaRef}
          value={body}
          placeholder={placeholder}
          disabled={isLocked}
          readOnly={isLocked}
          onChange={handlePlainTextareaChange}
        />
      </label>
    );
  }

  function handlePlainTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextBody = event.target.value;

    if (hasMemoCheckboxSyntax(nextBody)) {
      pendingSelectionRef.current = getEditorSelectionAfterCheckboxNormalization(
        nextBody,
        event.target.selectionStart ?? nextBody.length,
        event.target.selectionEnd ?? event.target.selectionStart ?? nextBody.length
      );
    }

    onChange(nextBody);
  }

  function handleChange(nextBody: string) {
    onChange(nextBody);
  }

  function handleEditorTextChange(nextEditorBody: string) {
    onChange(toMemoBodyFromEditorText(nextEditorBody));
  }

  function handleEditorTextareaChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextEditorBody = event.target.value;

    if (hasMemoCheckboxSyntax(nextEditorBody)) {
      pendingSelectionRef.current = getEditorSelectionAfterCheckboxNormalization(
        nextEditorBody,
        event.target.selectionStart ?? nextEditorBody.length,
        event.target.selectionEnd ?? event.target.selectionStart ?? nextEditorBody.length
      );
    }

    handleEditorTextChange(nextEditorBody);
  }

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    syncRendererScrollFromTextarea(event.currentTarget, rendererRef.current);
  }

  function setPendingSelection(selection: PendingSelection) {
    pendingSelectionRef.current = selection;
  }

  return (
    <div className={`${fieldClassName} note-body-editor note-body-editor--checkbox-mode`}>
      <div className="note-body-editor__surface">
        <div className={`note-body-renderer ${textareaClassName} ${rendererClassName}`} ref={rendererRef} data-testid="note-body-renderer" aria-hidden="true">
          {lines.map((editableLine) => (
            <VisualMemoLine
              key={editableLine.index}
              body={body}
              editableLine={editableLine}
              isLocked={isLocked}
              onChange={handleChange}
            />
          ))}
        </div>
        <textarea
          className={`${textareaClassName} note-body-editor__textarea-overlay`}
          data-testid="note-body-input"
          ref={textareaRef}
          value={editorBody}
          placeholder={placeholder}
          disabled={isLocked}
          readOnly={isLocked}
          spellCheck={false}
          onChange={handleEditorTextareaChange}
          onClick={(event) => keepCaretOutOfCheckboxMarker(event.currentTarget, body)}
          onKeyDown={(event) => handleTextareaKeyDown(event, body, handleChange, setPendingSelection)}
          onKeyUp={(event) => keepCaretOutOfCheckboxMarker(event.currentTarget, body)}
          onSelect={(event) => keepCaretOutOfCheckboxMarker(event.currentTarget, body)}
          onScroll={handleScroll}
        />
      </div>
    </div>
  );
}

function VisualMemoLine({
  body,
  editableLine,
  isLocked,
  onChange
}: {
  body: string;
  editableLine: EditableLine;
  isLocked: boolean;
  onChange: (body: string) => void;
}) {
  const checkbox = parseMemoCheckboxLine(editableLine.line);

  if (!checkbox) {
    return (
      <div className="note-body-renderer__line note-body-renderer__text-line">
        <span className="note-body-renderer__plain-text">{editableLine.line || "\u00a0"}</span>
      </div>
    );
  }

  return (
    <div className="note-body-renderer__line note-body-renderer__checkbox-line">
      <span className="note-body-renderer__checkbox-marker">
        <span className="note-body-renderer__checkbox-marker-text">{CHECKBOX_EDITOR_MARKER_UNCHECKED}</span>
        <input
          type="checkbox"
          className="note-body-renderer__checkbox"
          checked={checkbox.checked}
          disabled={isLocked}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onChange={(event) => onChange(toggleMemoCheckboxLine(body, editableLine.index, event.target.checked))}
          aria-label={checkbox.text || "체크박스"}
        />
      </span>
      <span className={`note-body-renderer__checkbox-text${checkbox.checked ? " is-checked" : ""}`}>{checkbox.text || "\u00a0"}</span>
    </div>
  );
}

function handleTextareaKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  body: string,
  onChange: (body: string) => void,
  setPendingSelection: (selection: PendingSelection) => void
) {
  if (isComposingKeyEvent(event)) {
    return;
  }

  const textarea = event.currentTarget;
  const selectionStart = textarea.selectionStart ?? 0;
  const selectionEnd = textarea.selectionEnd ?? selectionStart;
  const rangeStart = Math.min(selectionStart, selectionEnd);
  const rangeEnd = Math.max(selectionStart, selectionEnd);
  const lineRange = getLineRange(body, rangeStart);
  const checkbox = parseMemoCheckboxLine(lineRange.line);

  if (!checkbox) {
    if (handlePlainLineCheckboxBoundaryDelete(event, body, lineRange, rangeStart, rangeEnd, onChange, setPendingSelection)) {
      return;
    }

    return;
  }

  if (rangeEnd > lineRange.end) {
    return;
  }

  const prefixLength = getCheckboxTextStartOffset(lineRange.line, checkbox);
  const textStart = lineRange.start + prefixLength;
  const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
  const isCollapsed = rangeStart === rangeEnd;
  const isBeforeText = rangeStart < textStart;
  const isAtTextStart = isCollapsed && rangeStart === textStart;
  const shouldRemoveCheckbox =
    isDeleteKey &&
    isCollapsed &&
    (
      checkbox.text.length === 0 ||
      isBeforeText ||
      (event.key === "Backspace" && isAtTextStart)
    );

  if (shouldDeleteCheckboxText(event.key, checkbox.text, rangeStart, rangeEnd, textStart, lineRange.end)) {
    event.preventDefault();
    const next = deleteCheckboxTextRange(body, lineRange, checkbox, rangeStart, rangeEnd, textStart, event.key);
    setPendingSelection({ start: next.selection, end: next.selection });
    onChange(next.body);
    return;
  }

  if (shouldRemoveCheckbox) {
    event.preventDefault();
    const next = removeCheckboxFromLine(body, lineRange, checkbox.text);
    setPendingSelection({ start: next.selection, end: next.selection });
    onChange(next.body);
    return;
  }

  if (event.key === "Delete" && isCollapsed && rangeStart === lineRange.end && getNextLineCheckbox(body, lineRange)) {
    event.preventDefault();
    textarea.setSelectionRange(rangeStart, rangeStart);
    return;
  }

  if ((event.key === "Home" || event.key === "ArrowLeft") && isCollapsed && rangeStart <= textStart) {
    event.preventDefault();
    textarea.setSelectionRange(textStart, textStart);
    return;
  }

  if (event.key !== "Enter" || event.repeat) {
    return;
  }

  event.preventDefault();

  const checkboxTextSelectionStart = clamp(rangeStart - textStart, 0, checkbox.text.length);
  const checkboxTextSelectionEnd = clamp(rangeEnd - textStart, checkboxTextSelectionStart, checkbox.text.length);

  if (checkbox.text.length === 0) {
    const nextBody = replaceBodyRange(body, lineRange.start, lineRange.end, "");
    setPendingSelection({ start: lineRange.start, end: lineRange.start });
    onChange(nextBody);
    return;
  }

  const beforeText = checkbox.text.slice(0, checkboxTextSelectionStart);
  const afterText = checkbox.text.slice(checkboxTextSelectionEnd);
  const currentLine = formatMemoCheckboxLine({ ...checkbox, text: beforeText });
  const nextLine = formatMemoCheckboxLine({
    indentation: checkbox.indentation,
    checked: false,
    text: afterText
  });
  const replacement = `${currentLine}\n${nextLine}`;
  const nextCheckbox = parseMemoCheckboxLine(nextLine);
  const nextSelection = lineRange.start + currentLine.length + 1 + (nextCheckbox ? getCheckboxTextStartOffset(nextLine, nextCheckbox) : nextLine.length);

  setPendingSelection({ start: nextSelection, end: nextSelection });
  onChange(replaceBodyRange(body, lineRange.start, lineRange.end, replacement));
}

function handlePlainLineCheckboxBoundaryDelete(
  event: KeyboardEvent<HTMLTextAreaElement>,
  body: string,
  lineRange: BodyLineRange,
  rangeStart: number,
  rangeEnd: number,
  onChange: (body: string) => void,
  setPendingSelection: (selection: PendingSelection) => void
) {
  if (rangeStart !== rangeEnd) {
    return false;
  }

  if (event.key !== "Delete" || rangeStart !== lineRange.end) {
    return false;
  }

  const nextCheckbox = getNextLineCheckbox(body, lineRange);

  if (!nextCheckbox) {
    return false;
  }

  event.preventDefault();

  if (lineRange.line.length === 0) {
    const nextBody = replaceBodyRange(body, lineRange.start, lineRange.end + 1, "");
    setPendingSelection({ start: lineRange.start, end: lineRange.start });
    onChange(nextBody);
    return true;
  }

  event.currentTarget.setSelectionRange(rangeStart, rangeStart);
  return true;
}

function shouldDeleteCheckboxText(
  key: string,
  text: string,
  rangeStart: number,
  rangeEnd: number,
  textStart: number,
  lineEnd: number
) {
  if (key !== "Delete" && key !== "Backspace") {
    return false;
  }

  if (rangeStart !== rangeEnd) {
    return rangeEnd > textStart && rangeStart < lineEnd;
  }

  return (key === "Backspace" && rangeStart > textStart) || (key === "Delete" && rangeStart >= textStart && rangeStart < lineEnd && text.length > 0);
}

function deleteCheckboxTextRange(
  body: string,
  lineRange: BodyLineRange,
  checkbox: ParsedMemoCheckboxLine,
  rangeStart: number,
  rangeEnd: number,
  textStart: number,
  key: string
) {
  let deleteStart = clamp(rangeStart - textStart, 0, checkbox.text.length);
  let deleteEnd = clamp(rangeEnd - textStart, deleteStart, checkbox.text.length);

  if (rangeStart === rangeEnd) {
    if (key === "Backspace") {
      deleteStart = clamp(deleteStart - 1, 0, checkbox.text.length);
    } else {
      deleteEnd = clamp(deleteEnd + 1, deleteStart, checkbox.text.length);
    }
  }

  const nextText = `${checkbox.text.slice(0, deleteStart)}${checkbox.text.slice(deleteEnd)}`;
  const nextLine = formatMemoCheckboxLine({ ...checkbox, text: nextText });
  const nextSelection = lineRange.start + CHECKBOX_EDITOR_MARKER_LENGTH + deleteStart;

  return {
    body: replaceBodyRange(body, lineRange.start, lineRange.end, nextLine),
    selection: nextSelection
  };
}

function buildEditableLines(body: string): EditableLine[] {
  let lineStart = 0;
  return body.split("\n").map((line, index) => {
    const editableLine = { index, line, lineStart };
    lineStart += line.length + 1;
    return editableLine;
  });
}

function toCheckboxEditorText(body: string) {
  return body
    .split("\n")
    .map((line) => {
      const checkbox = parseMemoCheckboxLine(line);
      return checkbox ? `${getCheckboxEditorMarker(checkbox.checked)}${checkbox.text}` : line;
    })
    .join("\n");
}

function toMemoBodyFromEditorText(editorBody: string) {
  return editorBody
    .split("\n")
    .map((line) => {
      const editorCheckbox = parseCheckboxEditorLine(line);

      if (!editorCheckbox) {
        return line;
      }

      return formatMemoCheckboxLine(editorCheckbox);
    })
    .join("\n");
}

function getCheckboxEditorMarker(checked: boolean) {
  return checked ? CHECKBOX_EDITOR_MARKER_CHECKED : CHECKBOX_EDITOR_MARKER_UNCHECKED;
}

function parseCheckboxEditorLine(line: string) {
  if (line.startsWith(CHECKBOX_EDITOR_MARKER_CHECKED)) {
    return {
      checked: true,
      text: line.slice(CHECKBOX_EDITOR_MARKER_LENGTH)
    };
  }

  if (line.startsWith(CHECKBOX_EDITOR_MARKER_UNCHECKED)) {
    return {
      checked: false,
      text: line.slice(CHECKBOX_EDITOR_MARKER_LENGTH)
    };
  }

  return null;
}

function getEditorSelectionAfterCheckboxNormalization(body: string, selectionStart: number, selectionEnd: number): PendingSelection {
  return {
    start: mapSourceOffsetToCheckboxEditorOffset(body, selectionStart),
    end: mapSourceOffsetToCheckboxEditorOffset(body, selectionEnd)
  };
}

function mapSourceOffsetToCheckboxEditorOffset(body: string, offset: number) {
  let sourceLineStart = 0;
  let editorLineStart = 0;

  for (const line of body.split("\n")) {
    const sourceLineEnd = sourceLineStart + line.length;

    if (offset <= sourceLineEnd) {
      return editorLineStart + mapSourceLineOffsetToEditorLineOffset(line, offset - sourceLineStart);
    }

    sourceLineStart = sourceLineEnd + 1;
    editorLineStart += getCheckboxEditorLineLength(line) + 1;
  }

  return editorLineStart;
}

function mapSourceLineOffsetToEditorLineOffset(line: string, offset: number) {
  const checkbox = parseMemoCheckboxLine(line);

  if (!checkbox) {
    return offset;
  }

  const textStart = getSourceCheckboxTextStartOffset(line, checkbox);
  const textOffset = clamp(offset - textStart, 0, checkbox.text.length);
  return CHECKBOX_EDITOR_MARKER_LENGTH + textOffset;
}

function getCheckboxEditorLineLength(line: string) {
  const checkbox = parseMemoCheckboxLine(line);
  return checkbox ? CHECKBOX_EDITOR_MARKER_LENGTH + checkbox.text.length : line.length;
}

function getLineRange(body: string, index: number): BodyLineRange {
  const start = findLineStart(body, index);
  const end = findLineEnd(body, index);

  return {
    start,
    end,
    line: body.slice(start, end)
  };
}

function getNextLineCheckbox(body: string, lineRange: BodyLineRange) {
  if (lineRange.end >= body.length) {
    return null;
  }

  const nextLineStart = lineRange.end + 1;
  const nextLineEnd = findLineEnd(body, nextLineStart);
  return parseMemoCheckboxLine(body.slice(nextLineStart, nextLineEnd));
}

function findLineStart(body: string, index: number) {
  if (index <= 0) {
    return 0;
  }

  return body.lastIndexOf("\n", index - 1) + 1;
}

function findLineEnd(body: string, index: number) {
  const nextNewline = body.indexOf("\n", index);
  return nextNewline === -1 ? body.length : nextNewline;
}

function replaceBodyRange(body: string, start: number, end: number, replacement: string) {
  return `${body.slice(0, start)}${replacement}${body.slice(end)}`;
}

function removeCheckboxFromLine(body: string, lineRange: { start: number; end: number }, text: string) {
  return {
    body: replaceBodyRange(body, lineRange.start, lineRange.end, text),
    selection: lineRange.start
  };
}

function getCheckboxTextStartOffset(line: string, checkbox: { indentation: string; source: string }) {
  return CHECKBOX_EDITOR_MARKER_LENGTH;
}

function getSourceCheckboxTextStartOffset(line: string, checkbox: { indentation: string; source: string }) {
  if (checkbox.source === "markdown") {
    const marker = line.slice(checkbox.indentation.length).match(/^[-*]\s+\[[ xX]\]\s?/u)?.[0];

    if (marker) {
      return checkbox.indentation.length + marker.length;
    }
  }

  return checkbox.indentation.length + 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function syncRendererScrollFromTextarea(textarea: HTMLTextAreaElement, renderer: HTMLDivElement | null) {
  if (!renderer) {
    return;
  }

  renderer.scrollTop = textarea.scrollTop;
  renderer.scrollLeft = textarea.scrollLeft;
}

function restoreTextareaSelection(
  textarea: HTMLTextAreaElement | null,
  renderer: HTMLDivElement | null,
  selection: PendingSelection
) {
  if (!textarea) {
    return;
  }

  textarea.focus();
  textarea.setSelectionRange(selection.start, selection.end);
  syncRendererScrollFromTextarea(textarea, renderer);
}

function keepCaretOutOfCheckboxMarker(textarea: HTMLTextAreaElement, body: string) {
  const selectionStart = textarea.selectionStart ?? 0;
  const selectionEnd = textarea.selectionEnd ?? selectionStart;

  if (selectionStart !== selectionEnd) {
    return;
  }

  const lineRange = getLineRange(body, selectionStart);
  const checkbox = parseMemoCheckboxLine(lineRange.line);

  if (!checkbox) {
    return;
  }

  const textStart = lineRange.start + getCheckboxTextStartOffset(lineRange.line, checkbox);

  if (selectionStart >= lineRange.start && selectionStart < textStart) {
    textarea.setSelectionRange(textStart, textStart);
  }
}

function isComposingKeyEvent(event: KeyboardEvent<HTMLTextAreaElement>) {
  const nativeEvent = event.nativeEvent as globalThis.KeyboardEvent & { keyCode?: number };
  return nativeEvent.isComposing || nativeEvent.keyCode === 229;
}
