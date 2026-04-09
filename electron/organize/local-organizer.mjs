const supportedIntents = new Set(["polish", "polite"]);

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
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

function polishLine(line) {
  const compact = line.replace(/\s+/g, " ").trim();

  if (!compact) {
    return "";
  }

  return ensureTerminalPunctuation(compact.charAt(0).toUpperCase() + compact.slice(1));
}

function convertToPoliteTone(line) {
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
          summary: "Add some memo content before running organize."
        };
      }

      const suggested = buildSuggestion(original, intent);
      const summary =
        intent === "polite"
          ? "Converted the memo into a more polite, send-ready draft."
          : "Polished spacing, casing, and sentence endings for a cleaner draft.";

      return {
        intent,
        original,
        suggested,
        summary
      };
    }
  };
}
