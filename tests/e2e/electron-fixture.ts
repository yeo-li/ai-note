import { test as base, expect, type Page } from "@playwright/test";
import { _electron as electron, type ElectronApplication } from "playwright";

type ElectronFixtures = {
  electronApp: ElectronApplication;
  appWindow: Page;
};

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({
      args: ["."],
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_E2E: "1",
        E2E_WINDOW_WIDTH: "1440",
        E2E_WINDOW_HEIGHT: "960"
      }
    });

    await use(electronApp);
    await electronApp.close();
  },

  appWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();

    await window.waitForLoadState("domcontentloaded");
    await window.waitForSelector('[data-testid="app-shell"]');
    await use(window);
  }
});

export { expect };
