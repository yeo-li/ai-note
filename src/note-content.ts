const EMPTY_NOTE_HEADLINE = "내용이 비어 있는 메모";
const NOTE_HEADLINE_MAX_LENGTH = 64;
const STORAGE_TITLE_MAX_LENGTH = 120;

function getFirstNonEmptyLine(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function truncateWithEllipsis(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

export function deriveNoteHeadline(body: string) {
  const firstLine = getFirstNonEmptyLine(body);

  if (!firstLine) {
    return EMPTY_NOTE_HEADLINE;
  }

  return truncateWithEllipsis(firstLine, NOTE_HEADLINE_MAX_LENGTH);
}

export function buildMemoTitleFromBody(body: string) {
  const firstLine = getFirstNonEmptyLine(body);

  if (!firstLine) {
    return "";
  }

  return firstLine.slice(0, STORAGE_TITLE_MAX_LENGTH).trim();
}
