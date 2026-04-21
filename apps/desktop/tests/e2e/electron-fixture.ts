import { test as base, expect, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ElectronFixtures = {
  electronApp: ElectronApplication;
  appWindow: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const e2eUserDataPath = mkdtempSync(join(tmpdir(), "ai-note-e2e-"));
    const electronApp = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_E2E: "1",
        E2E_WINDOW_WIDTH: "1440",
        E2E_WINDOW_HEIGHT: "960",
        AI_NOTE_USER_DATA_PATH: e2eUserDataPath
      }
    });

    try {
      await use(electronApp);
    } finally {
      await electronApp.close();
      rmSync(e2eUserDataPath, {
        recursive: true,
        force: true
      });
    }
  },

  appWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="app-shell"]');
    await use(window);
  }
});

export { expect };
