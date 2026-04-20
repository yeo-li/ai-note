const supportedIntents = new Set(["polish", "polite"]);
const koreanPattern = /[가-힣]/u;

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(text) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function ensureTerminalPunctuation(line) {
  if (/[.!?。！？]$/.test(line)) {
    return line;
  }

  return `${line}.`;
}

function isKoreanText(text) {
  return koreanPattern.test(text);
}

function polishLine(line) {
  const compact = line.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  if (isKoreanText(compact)) {
    return ensureTerminalPunctuation(compact);
  }

  return ensureTerminalPunctuation(compact.charAt(0).toUpperCase() + compact.slice(1));
}

function convertKoreanLineToPoliteTone(line) {
  let rewritten = line.replace(/\s+/g, " ").trim();

  if (!rewritten) {
    return "";
  }

  rewritten = rewritten
    .replace(/보내줘$/u, "보내주세요")
    .replace(/확인해줘$/u, "확인해주세요")
    .replace(/정리해줘$/u, "정리해주세요")
    .replace(/알려줘$/u, "알려주세요")
    .replace(/해줘$/u, "해주세요")
    .replace(/봐줘$/u, "봐주세요")
    .replace(/부탁해$/u, "부탁드립니다")
    .replace(/할게$/u, "하겠습니다")
    .replace(/할께$/u, "하겠습니다")
    .replace(/고마워$/u, "감사합니다");

  if (!/(주세요|부탁드립니다|감사합니다|하겠습니다|드립니다|합니다|입니다|됩니다|요)$/u.test(rewritten)) {
    rewritten = `${rewritten} 부탁드립니다`;
  }

  return ensureTerminalPunctuation(rewritten);
}

function convertToPoliteTone(line) {
  if (isKoreanText(line)) {
    return convertKoreanLineToPoliteTone(line);
  }

  let rewritten = line.replace(/\s+/g, " ").trim();

  if (!rewritten) {
    return "";
  }

  rewritten = rewritten
    .replace(/\bcan you\b/gi, "could you please")
    .replace(/\bneed to\b/gi, "please")
    .replace(/\bi need\b/gi, "I would appreciate");

  if (!/^(please|could you please|i would appreciate)/i.test(rewritten)) {
    rewritten = `Please ${rewritten.charAt(0).toLowerCase()}${rewritten.slice(1)}`;
  }

  rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
  return ensureTerminalPunctuation(rewritten.replace(/^Please please/i, "Please"));
}

function buildSuggestion(body, intent) {
  const lines = splitSentences(normalizeWhitespace(body));

  if (lines.length === 0) {
    return "";
  }

  const transform = intent === "polite" ? convertToPoliteTone : polishLine;
  return lines.map(transform).join("\n");
}

export function createLocalOrganizer() {
  return {
    async organize({ intent, body = "" }) {
      if (!supportedIntents.has(intent)) {
        throw new Error("Unsupported organize intent.");
      }

      const original = normalizeWhitespace(body);

      if (!original) {
        return {
          intent,
          original: "",
          suggested: "",
          summary: "메모 내용을 입력한 뒤 다시 실행해 주세요."
        };
      }

      const suggested = buildSuggestion(original, intent);
      const summary =
        intent === "polite"
          ? "더 공손하고 바로 보낼 수 있는 문체로 정리했습니다."
          : "띄어쓰기와 문장 끝 표현을 다듬어 읽기 쉽게 정리했습니다.";

      return {
        intent,
        original,
        suggested,
        summary
      };
    }
  };
}
