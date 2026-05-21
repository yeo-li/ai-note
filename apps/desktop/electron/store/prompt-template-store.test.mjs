import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createPromptTemplateStore } from "./prompt-template-store.mjs";

async function withTempStore(run) {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-prompt-template-store-"));

  try {
    return await run(createPromptTemplateStore({ userDataPath }));
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
}

test("prompt template store starts empty", async () => {
  await withTempStore(async (store) => {
    const templates = await store.list();
    assert.deepEqual(templates, []);
    assert.equal(await store.update("missing", { name: "noop" }), null);
    assert.equal(await store.delete("missing"), false);
  });
});

test("prompt template store persists create update delete across instances", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "ai-note-prompt-template-store-"));

  try {
    const store = createPromptTemplateStore({ userDataPath });
    const created = await store.create({
      name: "요약",
      prompt: "핵심만 짧게 요약해줘"
    });

    const updated = await store.update(created.id, {
      name: "짧은 요약",
      prompt: "중요한 내용만 두세 줄로 요약해줘"
    });

    assert.equal(updated?.name, "짧은 요약");

    const reloadedStore = createPromptTemplateStore({ userDataPath });
    const listed = await reloadedStore.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
    assert.equal(listed[0]?.prompt, "중요한 내용만 두세 줄로 요약해줘");

    const removed = await reloadedStore.delete(created.id);
    assert.equal(removed, true);
    assert.deepEqual(await reloadedStore.list(), []);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});
