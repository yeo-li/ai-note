import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { OrganizeProviderError } from "./organize/organize-provider.mjs";

const defaultTimeoutMs = 300000;
const defaultModel = "gpt-5.4-mini";

function mapFailure(stderr, exitCode) {
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

function buildSearchInstruction({ query, memos }) {
  return [
    "You are an AI memo retriever for a desktop note app.",
    "Read all memos and choose the memos that are most relevant to the user's natural-language request.",
    "Return ONLY JSON matching the schema.",
    "Do not explain. Do not include scores or reasons.",
    "Pick only memo ids that should appear in the result list, in descending relevance order.",
    "Prefer higher recall when the user asks broad questions, but avoid clearly unrelated memos.",
    "<query>",
    query,
    "</query>",
    "<memos>",
    JSON.stringify(
      memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        body: memo.body
      }))
    ),
    "</memos>"
  ].join("\n");
}

function buildSearchSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["memoIds"],
    properties: {
      memoIds: {
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  };
}

function buildComposeInstruction({ prompt, memos }) {
  return [
    "You are an AI memo composition engine for a desktop note app.",
    "The user wants ONE brand-new memo created by exploring all memos and combining only the relevant material.",
    "You MUST search across the entire memo set before writing.",
    "Do not summarize every memo blindly. Select only the memos relevant to the prompt.",
    "The output memo must be a fresh draft, not an overwrite of an existing memo.",
    "Return ONLY JSON matching the schema.",
    "<prompt>",
    prompt,
    "</prompt>",
    "<memos>",
    JSON.stringify(
      memos.map((memo) => ({
        id: memo.id,
        title: memo.title,
        body: memo.body
      }))
    ),
    "</memos>"
  ].join("\n");
}

function buildComposeSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "body", "sourceMemoIds"],
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      sourceMemoIds: {
        type: "array",
        items: {
          type: "string"
        }
      }
    }
  };
}

async function runCodexJson({ model, cwd, prompt, schema, timeoutMs }) {
  const tempDir = await mkdtemp(join(tmpdir(), "ai-note-codex-ai-"));
  const schemaPath = join(tempDir, "schema.json");
  const outputPath = join(tempDir, "output.json");

  await writeFile(schemaPath, JSON.stringify(schema), "utf8");

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        "codex",
        [
          "exec",
          "--model",
          model,
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
        reject(mapFailure(error.message, -1));
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);

        if (exitCode !== 0) {
          reject(mapFailure(stderr || stdout, exitCode));
          return;
        }

        resolve({ stdout });
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });

    const rawOutput = await readFile(outputPath, "utf8").catch(() => "");
    return JSON.parse(rawOutput || result.stdout || "{}");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function createAiMemoProvider({ model = defaultModel, timeoutMs = defaultTimeoutMs, cwd = process.cwd() } = {}) {
  return {
    async searchMemos({ query, memos }) {
      const parsed = await runCodexJson({
        model,
        cwd,
        timeoutMs,
        prompt: buildSearchInstruction({ query, memos }),
        schema: buildSearchSchema()
      });

      return Array.isArray(parsed.memoIds) ? parsed.memoIds.map(String) : [];
    },

    async composeMemos({ prompt, memos }) {
      const parsed = await runCodexJson({
        model,
        cwd,
        timeoutMs,
        prompt: buildComposeInstruction({ prompt, memos }),
        schema: buildComposeSchema()
      });

      if (!parsed?.title || !parsed?.body) {
        throw new OrganizeProviderError("CLI_PARSE_FAILED", "AI 메모 조합 응답을 해석하지 못했어요.");
      }

      return {
        title: String(parsed.title),
        body: String(parsed.body),
        sourceMemoIds: Array.isArray(parsed.sourceMemoIds) ? parsed.sourceMemoIds.map(String) : []
      };
    }
  };
}
