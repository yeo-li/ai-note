import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { OrganizeProviderError } from "./organize-provider.mjs";

const defaultTimeoutMs = 20000;

function buildInstruction(input) {
  const intentGuide =
    input.intent === "polite"
      ? "Rewrite the memo into a more polite and send-ready tone while preserving meaning."
      : "Polish the memo for clarity, spacing, and natural phrasing while preserving meaning.";

  const userPrompt = input.prompt?.trim() ? `Additional user instruction: ${input.prompt.trim()}` : "";

  return [
    "You are organizing a memo for an Electron desktop app.",
    intentGuide,
    userPrompt,
    "Return only valid JSON matching the provided schema.",
    "The summary must be a short Korean sentence describing what changed.",
    "The original field must contain the cleaned original memo body.",
    "The suggested field must contain the rewritten memo body.",
    `Intent: ${input.intent}`,
    `Title: ${input.title ?? ""}`,
    "<memo>",
    input.body,
    "</memo>"
  ]
    .filter(Boolean)
    .join("\n\n");
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
          summary: String(parsed.summary)
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
