import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { OrganizeProviderError } from "./organize-provider.mjs";

const defaultTimeoutMs = 300000;

function buildInstruction(input) {
  const intentGuide =
      input.intent === "polite"
          ? "Rewrite into a polite, send-ready tone."
          : "Improve clarity, spacing, and natural phrasing.";

  const userPrompt = input.prompt?.trim()
      ? `User instruction (ABSOLUTE PRIORITY): ${input.prompt.trim()}`
      : "No additional user instruction.";

  return [
    "You are a deterministic memo rewriting engine.",
    "You MUST behave like a strict transformation system, not a creative writer.",
    "",
    "====================",
    "# SYSTEM CONTRACT",
    "====================",
    "You MUST transform input → output under strict rules.",
    "This prompt is a CONTRACT, not a suggestion.",
    "",
    "====================",
    "# PRIORITY ORDER (STRICT)",
    "====================",
    "1. User instruction",
    "2. Output schema",
    "3. Meaning preservation",
    "4. Intent guidance",
    "If conflict occurs → obey ONLY higher priority.",
    "",
    "====================",
    "# TASK DEFINITION",
    "====================",
    "- Rewrite memo while preserving meaning.",
    "- Do NOT change facts.",
    "- Do NOT drop important information.",
    "- Do NOT hallucinate.",
    "",
    "====================",
    "# ALLOWED OPERATIONS",
    "====================",
    "- simplify wording",
    "- restructure sentences",
    "- improve readability",
    "- adjust tone",
    "- add minimal connective words ONLY if necessary",
    "",
    "====================",
    "# FORBIDDEN OPERATIONS",
    "====================",
    "- adding new facts",
    "- removing key meaning",
    "- over-summarizing",
    "- changing intent",
    "- ignoring user instruction",
    "",
    "====================",
    "# CLEANING RULE (ORIGINAL FIELD)",
    "====================",
    "- trim whitespace",
    "- fix formatting ONLY",
    "- DO NOT paraphrase",
    "- DO NOT rewrite",
    "",
    "====================",
    "# SUMMARY RULE",
    "====================",
    "- EXACTLY ONE Korean sentence",
    "- MUST describe transformation",
    "- MUST NOT describe content",
    "- MUST be specific",
    "- ≤20 characters recommended",
    "- BAD examples:",
    "  ✗ 수정함",
    "  ✗ 개선함",
    "- GOOD examples:",
    "  ✓ 문장을 간결하게 축약",
    "  ✓ 구조를 목록형으로 재구성",
    "",
    "====================",
    "# OUTPUT SCHEMA (STRICT)",
    "====================",
    "{",
    '  "summary": string,',
    '  "original": string,',
    '  "suggested": string',
    "}",
    "",
    "====================",
    "# OUTPUT RULES",
    "====================",
    "- Return ONLY JSON",
    "- NO markdown",
    "- NO explanation",
    "- NO extra fields",
    "- MUST be parseable JSON",
    "- Escape quotes properly",
    "- Preserve line breaks with \\n",
    "",
    "====================",
    "# SELF VALIDATION (MANDATORY)",
    "====================",
    "Before output, internally verify:",
    "1. Is JSON valid?",
    "2. Did I follow priority rules?",
    "3. Did I avoid hallucination?",
    "4. Is summary compliant?",
    "If ANY fails → fix before output.",
    "",
    "====================",
    "# INPUT",
    "====================",
    "<instruction>",
    userPrompt,
    "</instruction>",
    "",
    "<intent>",
    intentGuide,
    "</intent>",
    "",
    "<context>",
    `Intent: ${input.intent}`,
    `Title: ${input.title ?? ""}`,
    "</context>",
    "",
    "<memo>",
    input.body,
    "</memo>"
  ]
      .filter(Boolean)
      .join("\n");
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["intent", "original", "suggested", "summary"],
    properties: {
      intent: {
        type: "string",
        enum: ["polish", "polite"]
      },
      original: {
        type: "string"
      },
      suggested: {
        type: "string"
      },
      summary: {
        type: "string"
      }
    }
  };
}

function mapCodexFailure(stderr, exitCode) {
  const message = stderr.trim();
  const normalized = message.toLowerCase();

  if (/not found|enoent|spawn codex/i.test(message)) {
    return new OrganizeProviderError("CLI_NOT_FOUND", "Codex CLI를 찾지 못했어요. 설치 상태를 확인해 주세요.");
  }

  if (/login|logged in|authentication|auth/i.test(normalized)) {
    return new OrganizeProviderError("CLI_NOT_AUTHENTICATED", "Codex CLI 로그인이 필요해요. 터미널에서 Codex 로그인을 확인해 주세요.");
  }

  return new OrganizeProviderError(
    "CLI_FAILED",
    message ? `Codex CLI 실행에 실패했어요: ${message}` : `Codex CLI 실행에 실패했어요. (exit code ${exitCode})`
  );
}

export function createCodexCliOrganizeProvider({
  runCommand = spawn,
  timeoutMs = defaultTimeoutMs,
  cwd = process.cwd()
} = {}) {
  return {
    async organize(input) {
      const tempDir = await mkdtemp(join(tmpdir(), "ai-note-codex-"));
      const schemaPath = join(tempDir, "organize-schema.json");
      const outputPath = join(tempDir, "organize-result.json");
      const prompt = buildInstruction(input);

      await writeFile(schemaPath, JSON.stringify(buildSchema()), "utf8");

      try {
        const result = await new Promise((resolve, reject) => {
          const child = runCommand(
            "codex",
            [
              "exec",
              "--skip-git-repo-check",
              "--sandbox",
              "read-only",
              "--json",
              "--output-schema",
              schemaPath,
              "--output-last-message",
              outputPath,
              "-"
            ],
            {
              cwd,
              shell: false,
              stdio: ["pipe", "pipe", "pipe"]
            }
          );

          let stdout = "";
          let stderr = "";
          const timer = setTimeout(() => {
            child.kill("SIGTERM");
            reject(new OrganizeProviderError("CLI_TIMEOUT", "Codex CLI 응답이 늦어서 요청을 중단했어요. 잠시 뒤 다시 시도해 주세요."));
          }, timeoutMs);

          child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
          });

          child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
          });

          child.on("error", (error) => {
            clearTimeout(timer);
            reject(mapCodexFailure(error.message, -1));
          });

          child.on("close", (exitCode) => {
            clearTimeout(timer);

            if (exitCode !== 0) {
              reject(mapCodexFailure(stderr || stdout, exitCode));
              return;
            }

            resolve({ stdout, stderr });
          });

          child.stdin.write(prompt);
          child.stdin.end();
        });

        const rawOutput = await readFile(outputPath, "utf8").catch(() => "");
        const parsed = JSON.parse(rawOutput || result.stdout || "{}");

        if (!parsed?.suggested || !parsed?.summary || !parsed?.original) {
          throw new OrganizeProviderError("CLI_PARSE_FAILED", "Codex CLI 응답을 정리 결과로 해석하지 못했어요.");
        }

        return {
          intent: input.intent,
          original: String(parsed.original),
          suggested: String(parsed.suggested),
          summary: String(parsed.summary),
          provider: "codex",
          fallbackErrorMessage: null
        };
      } catch (error) {
        if (error instanceof OrganizeProviderError) {
          throw error;
        }

        throw new OrganizeProviderError("CLI_PARSE_FAILED", "Codex CLI 응답을 정리 결과로 해석하지 못했어요.", error);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  };
}
