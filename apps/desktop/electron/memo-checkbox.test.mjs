import assert from "node:assert/strict";
import test from "node:test";

import {
  insertMemoCheckbox,
  normalizeMemoCheckboxSyntax,
  serializeMemoCheckboxesForMarkdown,
  toggleMemoCheckboxLine
} from "@ai-note/shared/memo";

test("normalizes checkbox syntax to markdown task syntax", () => {
  assert.equal(
    normalizeMemoCheckboxSyntax("☐ 초안 쓰기\n☑ 검토 완료\n일반 메모"),
    "- [ ] 초안 쓰기\n- [x] 검토 완료\n일반 메모"
  );
});

test("normalizes checkbox lines to start at the beginning of the line", () => {
  assert.equal(
    normalizeMemoCheckboxSyntax("  - [ ] 들여쓴 체크박스\n  ☑ 예전 체크박스"),
    "- [ ] 들여쓴 체크박스\n- [x] 예전 체크박스"
  );
});

test("serializes app checkbox syntax to markdown task syntax for AI", () => {
  assert.equal(
    serializeMemoCheckboxesForMarkdown("  ☐ 초안 쓰기\n  ☑ 검토 완료\n일반 메모"),
    "- [ ] 초안 쓰기\n- [x] 검토 완료\n일반 메모"
  );
});

test("toggles a checkbox line while keeping markdown syntax", () => {
  assert.equal(toggleMemoCheckboxLine("- [ ] 초안 쓰기\n일반 메모", 0, true), "- [x] 초안 쓰기\n일반 메모");
});

test("inserts a checkbox into the current text line", () => {
  const result = insertMemoCheckbox("초안 쓰기", 2, 2);

  assert.equal(result.body, "- [ ] 초안 쓰기");
  assert.equal(result.selectionStart, 8);
  assert.equal(result.selectionEnd, 8);
});

test("adds a new checkbox line below an existing checkbox", () => {
  const result = insertMemoCheckbox("- [ ] 초안 쓰기", 6, 6);

  assert.equal(result.body, "- [ ] 초안 쓰기\n- [ ] ");
  assert.equal(result.selectionStart, result.body.length);
  assert.equal(result.selectionEnd, result.body.length);
});
