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
    summary: "띄어쓰기와 문장 끝 표현을 다듬어 읽기 쉽게 정리했습니다."
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
