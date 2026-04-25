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
    const noteList = appWindow.getByTestId("note-list");

    await firstNote.click();
    await expect(firstNote).toHaveAttribute("aria-current", "true");
    const selectedBody = await bodyInput.inputValue();
    await expect(searchInput).toHaveAttribute("type", "text");

    await searchInput.fill("does-not-match-anything");
    await expect(searchInput).toBeFocused();
    await expect(appWindow.getByRole("button", { name: "검색어 지우기" })).toHaveCount(0);

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(0);
    await expect(appWindow.getByTestId("sidebar-empty-state")).toBeVisible();
    await expect(appWindow.getByTestId("editor-empty-state")).toBeHidden();
    await expect(bodyInput).toHaveValue(selectedBody);
    await expect(appWindow.getByTestId("status-live-region")).toContainText("찾지 못했어요");

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

    await expect(bodyInput).toHaveValue("첫 항목 - 두 번째 항목 부탁드립니다.");

    await bodyInput.fill("변환 이후 추가 편집");
    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await appWindow.getByTestId("restore-note-button").click();

    await expect(bodyInput).toHaveValue(originalBody);
  });

  test("shows the AI draft before applying it", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const draftBody = appWindow.getByTestId("transform-preview-body");
    const highlightedChanges = draftBody.locator(".transform-review-change");
    const originalBody = "적용 전 수정\n첫 문장\n두 번째 문장";
    const previewBody = "적용 전 수정.\n첫 문장.\n두 번째 문장.";

    await createButton.click();
    await bodyInput.fill(originalBody);

    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("핵심만 요약해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();

    await expect(draftBody).toContainText(previewBody);
    await expect(highlightedChanges).toHaveCount(3);
    await expect(appWindow.getByTestId("transform-original-body").locator(".transform-review-change")).toHaveCount(0);

    await appWindow.getByTestId("apply-transform-button").click();

    await expect(bodyInput).toHaveValue(previewBody);
  });

  test("saves applies edits and deletes AI prompt templates", async ({ appWindow }) => {
    await appWindow.getByTestId("sidebar-create-note-button").click();
    await appWindow.getByTestId("note-body-input").fill("template target\n본문입니다");

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-template-panel")).toBeVisible();

    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("save-prompt-template-button").click();
    await appWindow.getByTestId("prompt-template-name-input").fill("존댓말 템플릿");
    await appWindow.getByTestId("prompt-template-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByRole("button", { name: "템플릿 저장" }).click();

    const templateItem = appWindow.getByTestId("ai-template-list").getByRole("button", { name: "존댓말 템플릿" });
    await expect(templateItem).toBeVisible();

    await appWindow.getByTestId("ai-prompt-input").fill("다른 프롬프트");
    await templateItem.click();
    await expect(appWindow.getByTestId("ai-prompt-input")).toHaveValue("존댓말로 정리해줘");

    await appWindow.getByRole("button", { name: "수정" }).click();
    await appWindow.getByTestId("prompt-template-name-input").fill("수정된 템플릿");
    await appWindow.getByTestId("prompt-template-prompt-input").fill("핵심만 요약해줘");
    await appWindow.getByRole("button", { name: "수정 저장" }).click();

    const updatedTemplateItem = appWindow.getByTestId("ai-template-list").getByRole("button", { name: "수정된 템플릿" });
    await expect(updatedTemplateItem).toBeVisible();
    await updatedTemplateItem.click();
    await expect(appWindow.getByTestId("ai-prompt-input")).toHaveValue("핵심만 요약해줘");

    await appWindow.getByRole("button", { name: "삭제" }).click();
    await expect(updatedTemplateItem).toHaveCount(0);
  });

  test("shows only starred memos in the favorites view", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const noteList = appWindow.getByTestId("note-list");
    const favoriteButton = appWindow.getByTestId("selected-note-favorite-button");

    await createButton.click();
    await bodyInput.fill("favorite target\nkeep me starred");
    await favoriteButton.click();
    await expect(favoriteButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(favoriteButton).toHaveCSS("color", "rgb(0, 0, 0)");

    await createButton.click();
    await bodyInput.fill("regular target\nshould stay out");

    await appWindow.getByTestId("sidebar-favorites-view-button").click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(1);
    await expect(noteList).toContainText("favorite target");
    await expect(noteList).not.toContainText("regular target");

    await favoriteButton.click();
    await expect(appWindow.getByTestId("sidebar-empty-state")).toBeVisible();
  });

  test("locks editing while AI generates and keeps the busy state on the original note", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const noteList = appWindow.getByTestId("note-list");

    await createButton.click();
    await bodyInput.fill("busy target\n첫 문장\n두 번째 문장");

    await createButton.click();
    await bodyInput.fill("idle target\n다른 메모입니다");

    const busyNote = noteList.locator('[data-testid^="note-list-item-"]', { hasText: "busy target" }).first();
    const idleNote = noteList.locator('[data-testid^="note-list-item-"]', { hasText: "idle target" }).first();

    await busyNote.click();
    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();

    await expect(appWindow.getByTestId("transform-progress-banner")).toBeVisible();
    await expect(appWindow.getByTestId("note-body-input")).toBeDisabled();

    await idleNote.click();
    await expect(appWindow.getByTestId("transform-progress-banner")).toBeHidden();
    await expect(appWindow.getByTestId("note-body-input")).toBeEnabled();

    await busyNote.click();
    await expect(appWindow.getByTestId("transform-progress-banner")).toBeVisible();
    await expect(appWindow.getByTestId("note-body-input")).toBeDisabled();

    await expect(appWindow.getByTestId("transform-success-banner")).toContainText("초 만에 생성되었어요", { timeout: 4000 });
    await expect(appWindow.getByTestId("transform-preview")).toBeVisible();
  });

  test("locks sticky note editing while the same memo is organizing", async ({ electronApp, appWindow }) => {
    const bodyInput = appWindow.getByTestId("note-body-input");

    await appWindow.getByTestId("sidebar-create-note-button").click();
    await bodyInput.fill("sticky busy target\n같은 메모를 잠깁니다");

    const stickyWindowPromise = electronApp.waitForEvent("window");
    await appWindow.getByTestId("open-sticky-note-button").click();

    const stickyWindow = await stickyWindowPromise;
    await stickyWindow.waitForLoadState("domcontentloaded");
    await stickyWindow.waitForSelector('[data-testid="note-body-input"]');

    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("핵심만 요약해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();

    await expect(stickyWindow.getByTestId("note-body-input")).toBeDisabled();
    await expect(appWindow.getByTestId("transform-progress-banner")).toBeVisible();
  });

  test("search and in-note find close the AI organize surface", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");

    await createButton.click();
    await bodyInput.fill("close overlays\nAI prompt should close");

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();

    await appWindow.getByTestId("note-search-input").fill("close overlays");
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeHidden();

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();

    await appWindow.getByTestId("note-find-toggle-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeHidden();
    await expect(appWindow.getByTestId("note-find-bar")).toBeVisible();
  });

  test("opens in-note find with platform shortcut and moves between matches", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");

    await createButton.click();
    await bodyInput.fill("find target\nalpha beta alpha beta");

    await appWindow.keyboard.press(process.platform === "darwin" ? "Meta+F" : "Control+F");

    await expect(appWindow.getByTestId("note-find-bar")).toBeVisible();
    await expect(appWindow.getByTestId("note-find-input")).toBeFocused();

    await appWindow.getByTestId("note-find-input").fill("alpha");
    await expect(appWindow.getByTestId("note-find-count")).toContainText("1/2");

    await appWindow.getByTestId("note-find-next-button").click();
    await expect(appWindow.getByTestId("note-find-count")).toContainText("2/2");

    await appWindow.getByTestId("note-find-close-button").click();
    await expect(appWindow.getByTestId("note-find-bar")).toBeHidden();
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

    await appWindow.getByTestId("selected-note-menu-button").click();
    await appWindow.getByTestId("selected-note-delete-button").click();
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(filteredItems).toHaveCount(2);
    await expect(bodyInput).toHaveValue(/qa filter set 2/);
  });

  test("opens transform preview and supports delete undo flow", async ({ appWindow }) => {
    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const noteList = appWindow.getByTestId("note-list");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const previewBody = appWindow.getByTestId("transform-preview-body");

    await createButton.click();
    await bodyInput.fill("Preview and delete\n\n첫 문장입니다.\n\n두 번째 문장입니다.");

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await appWindow.getByTestId("ai-prompt-input").fill("목록으로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await expect(appWindow.getByTestId("transform-preview")).toBeVisible();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await expect(appWindow.getByTestId("ai-prompt-input")).toHaveValue("목록으로 정리해줘");
    await expect(appWindow.getByTestId("submit-ai-prompt-button")).toHaveText("다시 생성");
    await expect(previewBody).toContainText("Preview and delete.");
    await appWindow.getByTestId("ai-prompt-input").fill("핵심만 요약해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await expect(appWindow.getByTestId("ai-prompt-input")).toHaveValue("핵심만 요약해줘");
    await expect(previewBody).toContainText("Preview and delete");
    await expect(previewBody).not.toContainText("- Preview and delete");
    await expect(appWindow.getByTestId("transform-original-note")).toBeVisible();
    await expect(appWindow.getByTestId("transform-original-body")).toContainText("Preview and delete");
    await expect(appWindow.getByTestId("transform-original-body")).toContainText("첫 문장입니다.");
    await expect(appWindow.getByTestId("cancel-transform-button")).toBeVisible();
    await expect(appWindow.getByTestId("apply-transform-button")).toBeVisible();
    await appWindow.getByTestId("cancel-transform-button").click();
    await expect(appWindow.getByTestId("transform-preview")).toBeHidden();
    await expect(bodyInput).toHaveValue("Preview and delete\n\n첫 문장입니다.\n\n두 번째 문장입니다.");

    const countBeforeDelete = await noteList.locator('[data-testid^="note-list-item-"]').count();

    await appWindow.getByTestId("selected-note-menu-button").click();
    await appWindow.getByTestId("selected-note-delete-button").click();
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete - 1);

    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(noteList.locator('[data-testid^="note-list-item-"]')).toHaveCount(countBeforeDelete);
  });

  test("keeps the compare view scrollable for long AI previews", async ({ electronApp, appWindow }) => {
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setSize(960, 700);
    });

    const createButton = appWindow.getByTestId("sidebar-create-note-button");
    const bodyInput = appWindow.getByTestId("note-body-input");
    const previewBody = appWindow.getByTestId("transform-preview-body");
    const originalBody = appWindow.getByTestId("transform-original-body");

    const longBody = Array.from({ length: 80 }, (_, index) => `긴 비교 본문 ${index + 1}번째 줄입니다. 하단 스크롤 확인용 문장입니다.`).join("\n");

    await createButton.click();
    await bodyInput.fill(longBody);

    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("존댓말로 정리해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();

    await expect(appWindow.getByTestId("transform-preview")).toBeVisible();

    for (const locator of [previewBody, originalBody]) {
      const scrollState = await locator.evaluate((node) => {
        const container = node as HTMLElement;
        const beforeTop = container.scrollTop;

        container.scrollTop = container.scrollHeight;

        return {
          beforeTop,
          afterTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight
        };
      });

      expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
      expect(scrollState.afterTop).toBeGreaterThan(scrollState.beforeTop);
    }
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

    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await expect(restoreButton).toBeEnabled();
    await expect(bodyInput).toHaveValue("Please undo keeps restore path.\n삭제 전 원문 - 복원 확인 부탁드립니다.");

    await appWindow.getByTestId("selected-note-menu-button").click();
    await appWindow.getByTestId("selected-note-delete-button").click();
    await expect(appWindow.getByTestId("delete-confirm-modal")).toBeVisible();
    await appWindow.getByTestId("confirm-delete-button").click();
    await appWindow.getByRole("button", { name: "되돌리기" }).first().click();

    await expect(bodyInput).toHaveValue("Please undo keeps restore path.\n삭제 전 원문 - 복원 확인 부탁드립니다.");
    await appWindow.getByTestId("organize-note-button").click();
    await expect(appWindow.getByTestId("ai-prompt-form")).toBeVisible();
    await expect(restoreButton).toBeEnabled();

    await restoreButton.click();

    await expect(bodyInput).toHaveValue(originalBody);
  });
});
