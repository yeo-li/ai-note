import { test, expect } from "./electron-fixture";

test.describe("AI Note desktop smoke", () => {
  test("creates and edits a note without leaving the workspace", async ({ appWindow }) => {
    const noteList = appWindow.getByTestId("note-list");
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");

    const initialCount = await noteList.locator('[data-testid^="note-list-item-"]').count();

    await createButton.click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(initialCount + 1);
    await expect(bodyInput).toHaveValue("");

    await bodyInput.fill("QA smoke note\nPlaywright smoke coverage for Electron.");

    await expect(bodyInput).toHaveValue("QA smoke note\nPlaywright smoke coverage for Electron.");
    await expect(noteList.locator('[data-testid^="note-list-item-"]').first()).toContainText("QA smoke note");
  });

  test("syncs sticky-note edits to the main window without delay", async ({ electronApp, appWindow }) => {
    const noteList = appWindow.getByTestId("note-list");
    const primaryBodyInput = appWindow.getByTestId("note-body-input");

    await noteList.locator('[data-testid^="note-list-item-"]').first().click();

    const stickyWindowPromise = electronApp.waitForEvent("window");
    await appWindow.getByTestId("open-sticky-note-button").click();

    const stickyWindow = await stickyWindowPromise;
    await stickyWindow.waitForLoadState("domcontentloaded");
    await stickyWindow.waitForSelector('[data-testid="note-body-input"]');
    await expect(stickyWindow.getByTestId("sticky-mode-exit-button")).toBeVisible();
    await expect(stickyWindow.getByTestId("sticky-mode-pin-button")).toBeVisible();
    await expect(stickyWindow.getByTestId("sticky-mode-new-note-button")).toBeVisible();

    const pinButton = stickyWindow.getByTestId("sticky-mode-pin-button");
    await expect(pinButton).toHaveAttribute("aria-pressed", "false");
    await pinButton.click();
    await expect(pinButton).toHaveAttribute("aria-pressed", "true");

    const stickyBodyInput = stickyWindow.getByTestId("note-body-input");
    const syncedBody = "스티커 동기화 확인\n일반 창 즉시 반영";

    await stickyBodyInput.fill(syncedBody);

    await expect(primaryBodyInput).toHaveValue(syncedBody, { timeout: 1500 });
    await expect(noteList.locator('[data-testid^="note-list-item-"]').first()).toContainText("스티커 동기화 확인");
  });

  test("keeps selection separate from search when no result matches", async ({ appWindow }) => {
    const firstNote = appWindow.getByTestId("note-list").locator('[data-testid^="note-list-item-"]').first();
    const searchInput = appWindow.getByTestId("note-search-input");
    const bodyInput = appWindow.getByTestId("note-body-input");

    await firstNote.click();
    await expect(firstNote).toHaveAttribute("aria-current", "true");
    const selectedBody = await bodyInput.inputValue();

    await searchInput.fill("does-not-match-anything");

    await expect(appWindow.getByTestId("editor-empty-state")).toBeVisible();
    await expect(appWindow.getByTestId("sidebar-empty-state")).toBeVisible();
    await expect(appWindow.getByTestId("status-live-region")).toContainText("찾지 못했다");

    await searchInput.clear();

    await expect(bodyInput).toHaveValue(selectedBody);
  });

  test("restores the original body after a later edit", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const originalBody = "첫 항목 - 두 번째 항목";

    await createButton.click();
    await bodyInput.fill(originalBody);

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await appWindow.getByTestId("apply-transform-button").click();

    await expect(bodyInput).toHaveValue("첫 항목, 두 번째 항목 입니다.");

    await bodyInput.fill("변환 이후 추가 편집");
    await appWindow.getByTestId("restore-note-button").click();

    await expect(bodyInput).toHaveValue(originalBody);
  });

  test("keeps the adjacent visible note selected after deleting inside filtered results", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const noteList = appWindow.getByTestId("note-list");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const searchInput = appWindow.getByTestId("note-search-input");

    const labels = ["qa filter set 1", "qa filter set 2", "qa filter set 3", "qa filler note"];

    for (const label of labels) {
      await createButton.click();
      await bodyInput.fill(`${label}\n${label} body`);
    }

    await searchInput.fill("qa filter set");
    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(3);

    const filteredItems = noteList.locator('[data-testid^="note-list-item-"]');

    await filteredItems.first().click();
    await expect(bodyInput).toHaveValue(/qa filter set 3/);

    await appWindow.getByTestId("begin-delete-button").click();
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(filteredItems).toHaveCount(2);
    await expect(bodyInput).toHaveValue(/qa filter set 2/);
  });

  test("opens transform preview and supports delete undo flow", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const noteList = appWindow.getByTestId("note-list");
    const bodyInput = appWindow.getByTestId("note-body-input");

    await createButton.click();
    await bodyInput.fill("Preview and delete\n\n첫 문장입니다.\n\n두 번째 문장입니다.");

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
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete - 1);

    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete);
  });

  test("restores AI original backup after delete undo", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const restoreButton = appWindow.getByTestId("restore-note-button");
    const originalBody = "Undo keeps restore path\n삭제 전 원문 - 복원 확인";

    await createButton.click();
    await bodyInput.fill(originalBody);

    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await appWindow.getByTestId("apply-transform-button").click();

    await expect(restoreButton).toBeEnabled();
    await expect(bodyInput).toHaveValue("Undo keeps restore path 삭제 전 원문, 복원 확인 입니다.");

    await appWindow.getByTestId("begin-delete-button").click();
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();
    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(bodyInput).toHaveValue("Undo keeps restore path 삭제 전 원문, 복원 확인 입니다.");
    await expect(restoreButton).toBeEnabled();

    await restoreButton.click();

    await expect(bodyInput).toHaveValue(originalBody);
  });
});
