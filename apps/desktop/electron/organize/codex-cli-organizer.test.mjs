import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { writeFileSync } from "node:fs";
import { createCodexCliOrganizeProvider } from "./codex-cli-organizer.mjs";
import { OrganizeProviderError } from "./organize-provider.mjs";

function createFakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    write() {},
    end() {}
  };
  child.kill = () => {};
  return child;
}

test("codex cli organize provider parses structured output from output-last-message", async () => {
  let stdinPrompt = "";

  const provider = createCodexCliOrganizeProvider({
    runCommand(command, args) {
      assert.equal(command, "codex");
      const modelIndex = args.indexOf("--model");
      const outputIndex = args.indexOf("--output-last-message");
      assert.notEqual(modelIndex, -1);
      assert.equal(args[modelIndex + 1], "gpt-5.4-mini");
      const outputPath = args[outputIndex + 1];
      const child = createFakeChild();

      child.stdin.write = (value) => {
        stdinPrompt += value;
      };

      queueMicrotask(() => {
        writeFileSync(
          outputPath,
          JSON.stringify({
            intent: "polish",
            original: "원문",
            suggested: "정리된 원문",
            summary: "읽기 좋게 정리했어요."
          }),
          "utf8"
        );
        child.emit("close", 0);
      });

      return child;
    }
  });

  const result = await provider.organize({ memoId: "memo-1", body: "원문", intent: "polish", prompt: "더 자연스럽게" });
  assert.equal(result.suggested, "정리된 원문");
  assert.equal(result.summary, "읽기 좋게 정리했어요.");
  assert.match(stdinPrompt, /1\. User instruction/);
  assert.match(stdinPrompt, /User instruction \(ABSOLUTE PRIORITY\): 더 자연스럽게/);
  assert.match(stdinPrompt, /This prompt is a CONTRACT, not a suggestion\./);
});

test("codex cli organize provider maps missing binary to a user-facing error", async () => {
  const provider = createCodexCliOrganizeProvider({
    runCommand() {
      const child = createFakeChild();

      queueMicrotask(() => {
        child.emit("error", new Error("spawn codex ENOENT"));
      });

      return child;
    }
  });

  await assert.rejects(
    provider.organize({ memoId: "memo-1", body: "원문", intent: "polish" }),
    (error) => error instanceof OrganizeProviderError && error.code === "CLI_NOT_FOUND"
  );
});
