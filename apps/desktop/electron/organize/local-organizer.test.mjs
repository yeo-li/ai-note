import assert from "node:assert/strict";
import test from "node:test";
import { createLocalOrganizer } from "./local-organizer.mjs";

test("local organizer polishes rough memo text deterministically", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "  교수님께   메일 보내기 \n 회의 내용   정리하기  "
  });

  assert.deepEqual(result, {
    intent: "polish",
    original: "교수님께 메일 보내기\n회의 내용 정리하기",
    suggested: "교수님께 메일 보내기.\n회의 내용 정리하기.",
    summary: "띄어쓰기와 문장 끝 표현을 다듬어 읽기 쉽게 정리했습니다.",
    provider: "local",
    fallbackErrorMessage: null
  });
});

test("local organizer rewrites text into a polite tone", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polite",
    body: "교수님께 메일 보내줘\n회의 내용 정리해줘"
  });

  assert.equal(result.intent, "polite");
  assert.equal(result.suggested, "교수님께 메일 보내주세요.\n회의 내용 정리해주세요.");
  assert.equal(result.summary, "더 공손하고 바로 보낼 수 있는 문체로 정리했습니다.");
  assert.equal(result.provider, "local");
  assert.equal(result.fallbackErrorMessage, null);
});

test("local organizer returns an empty suggestion for blank input", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "   \n"
  });

  assert.equal(result.suggested, "");
  assert.equal(result.summary, "메모 내용을 입력한 뒤 다시 실행해 주세요.");
});

test("local organizer reflects summary prompts in fallback mode", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "첫 번째 문장입니다\n두 번째 문장입니다\n세 번째 문장입니다\n네 번째 문장입니다",
    prompt: "핵심만 짧게 요약해줘"
  });

  assert.equal(result.suggested, "첫 번째 문장입니다.\n두 번째 문장입니다.\n세 번째 문장입니다.");
  assert.equal(result.summary, "요청한 흐름에 맞춰 핵심만 먼저 추렸습니다.");
});

test("local organizer reflects list prompts in fallback mode", async () => {
  const organizer = createLocalOrganizer();

  const result = await organizer.organize({
    intent: "polish",
    body: "교수님께 메일 보내기\n회의 내용 정리하기",
    prompt: "불릿 목록으로 정리해줘"
  });

  assert.equal(result.suggested, "- 교수님께 메일 보내기.\n- 회의 내용 정리하기.");
  assert.equal(result.summary, "보기 쉽게 목록 형태도 반영했습니다.");
});

test("local organizer rejects unsupported intents", async () => {
  const organizer = createLocalOrganizer();

  await assert.rejects(
    organizer.organize({
      intent: "summarize",
      body: "hello"
    }),
    /Unsupported organize intent/
  );
});
