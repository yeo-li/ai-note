import { existsSync } from "node:fs";

import { test, expect } from "./electron-fixture";

test.describe("AI Note desktop visuals", () => {
  test("matches the default workspace shell", async ({ appWindow }, testInfo) => {
    test.skip(
      !existsSync(testInfo.snapshotPath("workspace-default.png")) && testInfo.config.updateSnapshots === "none",
      `No committed visual baseline for ${process.platform}.`
    );
    await appWindow.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await expect(appWindow.getByTestId("app-shell")).toHaveScreenshot("workspace-default.png", { caret: "hide" });
  });

  test("matches the transform preview state", async ({ appWindow }, testInfo) => {
    test.skip(
      !existsSync(testInfo.snapshotPath("workspace-transform-preview.png")) &&
        testInfo.config.updateSnapshots === "none",
      `No committed visual baseline for ${process.platform}.`
    );
    await appWindow.getByTestId("organize-note-button").click();
    await appWindow.getByTestId("ai-prompt-input").fill("핵심만 요약해줘");
    await appWindow.getByTestId("submit-ai-prompt-button").click();
    await expect(appWindow.getByTestId("transform-preview")).toBeVisible();
    await appWindow.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await expect(appWindow.getByTestId("app-shell")).toHaveScreenshot("workspace-transform-preview.png", {
      caret: "hide"
    });
  });
});
