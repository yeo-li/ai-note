export type DiffSegment = {
  text: string;
  changed: boolean;
};
type LineDiffContext = {
  currentChanged: boolean | null;
  currentText: string;
  lcs: number[][];
  originalIndex: number;
  originalTokens: string[];
  previewIndex: number;
  previewTokens: string[];
  segments: DiffSegment[];
};
type PreviewDiffContext = {
  originalLines: string[];
  previewLines: string[];
  segments: DiffSegment[];
};

export function tokenizeDiffText(text: string) {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

export function buildLineDiffSegments(originalLine: string, previewLine: string) {
  const originalTokens = tokenizeDiffText(originalLine);
  const previewTokens = tokenizeDiffText(previewLine);
  const context = createLineDiffContext(originalTokens, previewTokens);

  collectLineDiffSegments(context);
  return context.segments;
}

export function buildPreviewDiffSegments(original: string, preview: string) {
  const context = createPreviewDiffContext(original, preview);

  appendPreviewDiffLines(context);
  return context.segments;
}

function createLineDiffContext(originalTokens: string[], previewTokens: string[]): LineDiffContext {
  return { currentChanged: null, currentText: "", lcs: buildLcsMatrix(originalTokens, previewTokens), originalIndex: 0, originalTokens, previewIndex: 0, previewTokens, segments: [] };
}

function buildLcsMatrix(originalTokens: string[], previewTokens: string[]) {
  const lcs = Array.from({ length: originalTokens.length + 1 }, () => Array(previewTokens.length + 1).fill(0));
  fillLcsMatrix(lcs, originalTokens, previewTokens);
  return lcs;
}

function fillLcsMatrix(lcs: number[][], originalTokens: string[], previewTokens: string[]) {
  for (let originalIndex = originalTokens.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let previewIndex = previewTokens.length - 1; previewIndex >= 0; previewIndex -= 1) {
      lcs[originalIndex][previewIndex] = getLcsScore(lcs, originalTokens, previewTokens, originalIndex, previewIndex);
    }
  }
}

function getLcsScore(lcs: number[][], originalTokens: string[], previewTokens: string[], originalIndex: number, previewIndex: number) {
  if (originalTokens[originalIndex] === previewTokens[previewIndex]) return lcs[originalIndex + 1][previewIndex + 1] + 1;
  return Math.max(lcs[originalIndex + 1][previewIndex], lcs[originalIndex][previewIndex + 1]);
}

function collectLineDiffSegments(context: LineDiffContext) {
  while (context.previewIndex < context.previewTokens.length) {
    appendNextLineDiffSegment(context);
  }

  flushSegment(context);
}

function appendNextLineDiffSegment(context: LineDiffContext) {
  if (isCurrentTokenMatched(context)) {
    appendMatchedToken(context);
    return;
  }

  if (shouldAppendChangedPreviewToken(context)) {
    appendChangedPreviewToken(context);
    return;
  }

  context.originalIndex += 1;
}

function isCurrentTokenMatched(context: LineDiffContext) {
  return context.originalIndex < context.originalTokens.length && context.originalTokens[context.originalIndex] === context.previewTokens[context.previewIndex];
}

function appendMatchedToken(context: LineDiffContext) {
  appendSegmentText(context, context.previewTokens[context.previewIndex], false);
  context.originalIndex += 1;
  context.previewIndex += 1;
}

function shouldAppendChangedPreviewToken(context: LineDiffContext) {
  if (context.originalIndex === context.originalTokens.length) return true;
  return getSkipPreviewScore(context) >= getSkipOriginalScore(context);
}

function appendChangedPreviewToken(context: LineDiffContext) {
  appendSegmentText(context, context.previewTokens[context.previewIndex], true);
  context.previewIndex += 1;
}

function getSkipPreviewScore(context: LineDiffContext) {
  return context.previewIndex + 1 <= context.previewTokens.length ? context.lcs[context.originalIndex]?.[context.previewIndex + 1] ?? 0 : 0;
}

function getSkipOriginalScore(context: LineDiffContext) {
  return context.originalIndex + 1 <= context.originalTokens.length ? context.lcs[context.originalIndex + 1]?.[context.previewIndex] ?? 0 : 0;
}

function flushSegment(context: LineDiffContext) {
  if (!context.currentText) return;
  context.segments.push({ text: context.currentText, changed: context.currentChanged ?? false });
  context.currentText = "";
}

function appendSegmentText(context: LineDiffContext, text: string, changed: boolean) {
  if (!text) return;
  if (context.currentChanged === changed) {
    context.currentText += text;
    return;
  }

  startNewSegment(context, text, changed);
}

function startNewSegment(context: LineDiffContext, text: string, changed: boolean) {
  flushSegment(context);
  context.currentText = text;
  context.currentChanged = changed;
}

function createPreviewDiffContext(original: string, preview: string): PreviewDiffContext {
  return { originalLines: original.split("\n"), previewLines: preview.split("\n"), segments: [] };
}

function appendPreviewDiffLines(context: PreviewDiffContext) {
  for (let lineIndex = 0; lineIndex < context.previewLines.length; lineIndex += 1) {
    appendPreviewDiffLine(context, lineIndex);
  }
}

function appendPreviewDiffLine(context: PreviewDiffContext, lineIndex: number) {
  const originalLine = context.originalLines[lineIndex] ?? "";
  const previewLine = context.previewLines[lineIndex] ?? "";

  appendPreviewLineSegments(context, originalLine, previewLine);
  appendPreviewLineBreak(context, lineIndex);
}

function appendPreviewLineSegments(context: PreviewDiffContext, originalLine: string, previewLine: string) {
  if (previewLine === originalLine) {
    context.segments.push({ text: previewLine, changed: false });
    return;
  }

  context.segments.push(...buildLineDiffSegments(originalLine, previewLine));
}

function appendPreviewLineBreak(context: PreviewDiffContext, lineIndex: number) {
  if (lineIndex < context.previewLines.length - 1) {
    context.segments.push({ text: "\n", changed: false });
  }
}
