import { test, expect } from "./electron-fixture";

test.describe("AI Note desktop smoke", () => {
  test("creates and edits a note without leaving the workspace", async ({ appWindow }) => {
    const noteList = appWindow.getByTestId("note-list");
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const titleInput = appWindow.getByTestId("note-title-input");
    const bodyInput = appWindow.getByTestId("note-body-input");

    const initialCount = await noteList.locator('[data-testid^="note-list-item-"]').count();

    await createButton.click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(initialCount + 1);
    await expect(titleInput).toHaveValue(/새 메모/);

    await titleInput.fill("QA smoke note");
    await bodyInput.fill("Playwright smoke coverage for Electron.");

    await expect(titleInput).toHaveValue("QA smoke note");
    await expect(bodyInput).toHaveValue("Playwright smoke coverage for Electron.");
  });

  test("keeps selection separate from search when no result matches", async ({ appWindow }) => {
    const firstNote = appWindow.getByTestId("note-list-item-note-1");
    const searchInput = appWindow.getByTestId("note-search-input");

    await firstNote.click();
    await expect(firstNote).toHaveAttribute("aria-current", "true");
    await expect(appWindow.getByTestId("note-title-input")).toHaveValue(/TDD/);

    await searchInput.fill("does-not-match-anything");

    await expect(appWindow.getByTestId("editor-empty-state")).toBeVisible();
    await expect(appWindow.getByTestId("sidebar-empty-state")).toBeVisible();
    await expect(appWindow.getByTestId("status-live-region")).toContainText("찾지 못했다");

    await searchInput.clear();

    await expect(appWindow.getByTestId("note-title-input")).toHaveValue(/TDD/);
  });

  test("restores the original body without overwriting a later title edit", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const titleInput = appWindow.getByTestId("note-title-input");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const originalBody = "첫 항목 - 두 번째 항목";

    await createButton.click();
    await titleInput.fill("Original title");
    await bodyInput.fill(originalBody);

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await appWindow.getByTestId("apply-transform-button").click();

    await expect(bodyInput).toHaveValue("첫 항목, 두 번째 항목 입니다.");

    await titleInput.fill("Retitled after AI");
    await appWindow.getByTestId("restore-note-button").click();

    await expect(titleInput).toHaveValue("Retitled after AI");
    await expect(bodyInput).toHaveValue(originalBody);
  });

  test("keeps the adjacent visible note selected after deleting inside filtered results", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const noteList = appWindow.getByTestId("note-list");
    const titleInput = appWindow.getByTestId("note-title-input");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const searchInput = appWindow.getByTestId("note-search-input");

    const titles = ["qa filter set 1", "qa filter set 2", "qa filter set 3", "qa filler note"];

    for (const title of titles) {
      await createButton.click();
      await titleInput.fill(title);
      await bodyInput.fill(`${title} body`);
    }

    await searchInput.fill("qa filter set");
    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(3);

    const filteredItems = noteList.locator('[data-testid^="note-list-item-"]');

    await filteredItems.first().click();
    await expect(titleInput).toHaveValue("qa filter set 3");

    await appWindow.getByTestId("begin-delete-button").click();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(filteredItems).toHaveCount(2);
    await expect(titleInput).toHaveValue("qa filter set 2");
  });

  test("opens transform preview and supports delete undo flow", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const noteList = appWindow.getByTestId("note-list");
    const titleInput = appWindow.getByTestId("note-title-input");
    const bodyInput = appWindow.getByTestId("note-body-input");

    await createButton.click();
    await titleInput.fill("Preview and delete");
    await bodyInput.fill("첫 문장입니다.\n\n두 번째 문장입니다.");

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await appWindow.getByTestId("ai-prompt-input").fill("목록으로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await expect(appWindow.getByTestId("transform-preview")).toBeVisible();
    await expect(appWindow.getByTestId("transform-preview")).toContainText("프롬프트: 목록으로 정리해줘");
    await expect(appWindow.getByTestId("transform-original-note")).toBeVisible();
    await expect(appWindow.getByTestId("transform-original-note")).toContainText("Preview and delete");
    await expect(appWindow.getByTestId("transform-original-body")).toContainText("첫 문장입니다.");

    await appWindow.getByTestId("cancel-transform-button").click();
    await expect(appWindow.getByTestId("transform-preview")).toBeHidden();

    const countBeforeDelete = await noteList.locator('[data-testid^="note-list-item-"]').count();

    await appWindow.getByTestId("begin-delete-button").click();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete - 1);

    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete);
  });

  test("restores AI original backup after delete undo", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const titleInput = appWindow.getByTestId("note-title-input");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const restoreButton = appWindow.getByTestId("restore-note-button");
    const originalBody = "삭제 전 원문 - 복원 확인";

    await createButton.click();
    await titleInput.fill("Undo keeps restore path");
    await bodyInput.fill(originalBody);

    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await appWindow.getByTestId("apply-transform-button").click();

    await expect(restoreButton).toBeEnabled();
    await expect(bodyInput).toHaveValue("삭제 전 원문, 복원 확인 입니다.");

    await appWindow.getByTestId("begin-delete-button").click();
    await appWindow.getByTestId("confirm-delete-button").click();
    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(titleInput).toHaveValue("Undo keeps restore path");
    await expect(restoreButton).toBeEnabled();

    await restoreButton.click();

    await expect(bodyInput).toHaveValue(originalBody);
  });
});
