export const MEMO_CATEGORIES = ["idea", "task", "journal", "reference", "other"];

export const MEMO_CATEGORY_LABELS = {
  idea: "아이디어",
  task: "할 일",
  journal: "회고",
  reference: "정보",
  other: "기타"
};

export const MEMO_STICKY_COLORS = ["yellow", "pink", "blue", "green", "purple"];
export const MEMO_CHECKBOX_UNCHECKED = "- [ ]";
export const MEMO_CHECKBOX_CHECKED = "- [x]";

const APP_CHECKBOX_LINE_PATTERN = /^(\s*)([☐☑])(?:[ \t](.*)|[ \t]*)$/u;
const MARKDOWN_CHECKBOX_LINE_PATTERN = /^(\s*)[-*]\s+\[([ xX])\]\s?(.*)$/u;

export function normalizeMemoCategoryValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/gu, " ");
  return normalized.length > 0 ? normalized.slice(0, 32) : null;
}

export function getMemoCategoryLabel(category) {
  if (typeof category !== "string" || category.length === 0) {
    return "";
  }

  return MEMO_CATEGORY_LABELS[category] ?? category;
}

export function normalizeMemoCategoryDescription(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/gu, " ").slice(0, 200);
}

export function normalizeMemoStickyColor(value) {
  return typeof value === "string" && MEMO_STICKY_COLORS.includes(value) ? value : null;
}

export function parseMemoCheckboxLine(line) {
  if (typeof line !== "string") {
    return null;
  }

  const appMatch = line.match(APP_CHECKBOX_LINE_PATTERN);

  if (appMatch) {
    return {
      indentation: appMatch[1] ?? "",
      checked: appMatch[2] === "☑",
      text: appMatch[3] ?? "",
      source: "app"
    };
  }

  const markdownMatch = line.match(MARKDOWN_CHECKBOX_LINE_PATTERN);

  if (!markdownMatch) {
    return null;
  }

  return {
    indentation: markdownMatch[1] ?? "",
    checked: String(markdownMatch[2] ?? "").toLowerCase() === "x",
    text: markdownMatch[3] ?? "",
    source: "markdown"
  };
}

export function formatMemoCheckboxLine({ checked = false, text = "" } = {}) {
  const marker = checked ? MEMO_CHECKBOX_CHECKED : MEMO_CHECKBOX_UNCHECKED;
  return `${marker}${text ? ` ${text}` : " "}`;
}

export function normalizeMemoCheckboxSyntax(body) {
  if (typeof body !== "string" || body.length === 0) {
    return typeof body === "string" ? body : "";
  }

  return body
    .split("\n")
    .map((line) => {
      const checkbox = parseMemoCheckboxLine(line);
      return checkbox ? formatMemoCheckboxLine(checkbox) : line;
    })
    .join("\n");
}

export function serializeMemoCheckboxesForMarkdown(body) {
  if (typeof body !== "string" || body.length === 0) {
    return typeof body === "string" ? body : "";
  }

  return body
    .split("\n")
    .map((line) => {
      const checkbox = parseMemoCheckboxLine(line);
      return checkbox ? `- [${checkbox.checked ? "x" : " "}] ${checkbox.text}` : line;
    })
    .join("\n");
}

export function hasMemoCheckboxSyntax(body) {
  return typeof body === "string" && body.split("\n").some((line) => Boolean(parseMemoCheckboxLine(line)));
}

export function toggleMemoCheckboxLine(body, lineIndex, checked) {
  if (typeof body !== "string") {
    return "";
  }

  return body
    .split("\n")
    .map((line, index) => {
      if (index !== lineIndex) {
        return line;
      }

      const checkbox = parseMemoCheckboxLine(line);
      return checkbox ? formatMemoCheckboxLine({ ...checkbox, checked }) : line;
    })
    .join("\n");
}

export function insertMemoCheckbox(body, selectionStart, selectionEnd = selectionStart) {
  const sourceBody = typeof body === "string" ? body : "";
  const start = clampSelectionIndex(selectionStart, sourceBody.length);
  const end = clampSelectionIndex(selectionEnd, sourceBody.length);
  const rangeStart = Math.min(start, end);
  const rangeEnd = Math.max(start, end);

  if (rangeStart !== rangeEnd) {
    return insertMemoCheckboxForSelectedLines(sourceBody, rangeStart, rangeEnd);
  }

  return insertMemoCheckboxAtCursor(sourceBody, rangeStart);
}

function insertMemoCheckboxForSelectedLines(body, selectionStart, selectionEnd) {
  const lineStart = findLineStart(body, selectionStart);
  const lineEnd = findLineEnd(body, selectionEnd);
  const replacement = body
    .slice(lineStart, lineEnd)
    .split("\n")
    .map(toUncheckedCheckboxLine)
    .join("\n");
  const nextBody = replaceBodyRange(body, lineStart, lineEnd, replacement);
  const nextSelection = lineStart + replacement.length;

  return {
    body: nextBody,
    selectionStart: nextSelection,
    selectionEnd: nextSelection
  };
}

function insertMemoCheckboxAtCursor(body, cursor) {
  const lineStart = findLineStart(body, cursor);
  const lineEnd = findLineEnd(body, cursor);
  const line = body.slice(lineStart, lineEnd);
  const checkbox = parseMemoCheckboxLine(line);

  if (checkbox) {
    const insertion = `${lineEnd > 0 || body.length > 0 ? "\n" : ""}${MEMO_CHECKBOX_UNCHECKED} `;
    const insertionIndex = lineEnd;
    const nextCursor = insertionIndex + insertion.length;

    return {
      body: replaceBodyRange(body, insertionIndex, insertionIndex, insertion),
      selectionStart: nextCursor,
      selectionEnd: nextCursor
    };
  }

  if (line.trim().length === 0) {
    const replacement = `${MEMO_CHECKBOX_UNCHECKED} `;
    const nextCursor = lineStart + replacement.length;

    return {
      body: replaceBodyRange(body, lineStart, lineEnd, replacement),
      selectionStart: nextCursor,
      selectionEnd: nextCursor
    };
  }

  const indentation = line.match(/^\s*/u)?.[0] ?? "";
  const content = line.slice(indentation.length);
  const replacement = `${MEMO_CHECKBOX_UNCHECKED} ${content}`;
  const insertedLength = `${MEMO_CHECKBOX_UNCHECKED} `.length;
  const indentationEnd = lineStart + indentation.length;
  const nextCursor = cursor >= indentationEnd ? cursor + insertedLength : lineStart + replacement.length;

  return {
    body: replaceBodyRange(body, lineStart, lineEnd, replacement),
    selectionStart: nextCursor,
    selectionEnd: nextCursor
  };
}

function toUncheckedCheckboxLine(line) {
  const checkbox = parseMemoCheckboxLine(line);

  if (checkbox) {
    return formatMemoCheckboxLine({ ...checkbox, checked: false });
  }

  return `${MEMO_CHECKBOX_UNCHECKED} ${line.trimStart()}`;
}

function clampSelectionIndex(value, length) {
  return Math.min(Math.max(Number.isFinite(value) ? Number(value) : length, 0), length);
}

function findLineStart(body, index) {
  if (index <= 0) {
    return 0;
  }

  return body.lastIndexOf("\n", index - 1) + 1;
}

function findLineEnd(body, index) {
  const nextNewline = body.indexOf("\n", index);
  return nextNewline === -1 ? body.length : nextNewline;
}

function replaceBodyRange(body, start, end, replacement) {
  return `${body.slice(0, start)}${replacement}${body.slice(end)}`;
}
