import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { memoChannels } from "./memo-channels.mjs";
import { createMemoSearchService } from "./search/memo-search-service.mjs";
import { createLocalOrganizer } from "./organize/local-organizer.mjs";
import { createMemoStore } from "./store/memo-store.mjs";
import { createMemoSqliteStore } from "./store/memo-sqlite-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
const defaultMinimumSize = {
  width: 640,
  height: 720
};
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === "1";
const userDataPathOverride = process.env.AI_NOTE_USER_DATA_PATH;

if (userDataPathOverride) {
  app.setPath("userData", userDataPathOverride);
}

function parseDimension(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTestWindowBounds(workArea) {
  if (!isPlaywrightE2E) {
    return null;
  }

  const requestedWidth = parseDimension(process.env.E2E_WINDOW_WIDTH) ?? 1440;
  const requestedHeight = parseDimension(process.env.E2E_WINDOW_HEIGHT) ?? 960;
  const width = Math.min(requestedWidth, workArea.width);
  const height = Math.min(requestedHeight, workArea.height);

  return {
    x: workArea.x + Math.max(Math.floor((workArea.width - width) / 2), 0),
    y: workArea.y + Math.max(Math.floor((workArea.height - height) / 2), 0),
    width,
    height
  };
}

function getWindowMetrics(display = screen.getPrimaryDisplay()) {
  const bounds = getTestWindowBounds(display.workArea) ?? display.workArea;

  return {
    bounds,
    minimumSize: {
      width: Math.min(defaultMinimumSize.width, bounds.width),
      height: Math.min(defaultMinimumSize.height, bounds.height)
    }
  };
}

function fitWindowToDisplay(mainWindow) {
  const targetDisplay = screen.getDisplayMatching(mainWindow.getBounds());
  const { bounds, minimumSize } = getWindowMetrics(targetDisplay);

  mainWindow.setMinimumSize(minimumSize.width, minimumSize.height);
  mainWindow.setMaximumSize(isPlaywrightE2E ? bounds.width : 2147483647, isPlaywrightE2E ? bounds.height : 2147483647);

  if (!mainWindow.isFullScreen()) {
    mainWindow.setBounds(bounds);
  }
}

function normalizeMemoId(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function normalizeMemoInput(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return {
    title: typeof value.title === "string" ? value.title : undefined,
    body: typeof value.body === "string" ? value.body : undefined
  };
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "알 수 없는 저장소 오류";
}

function normalizeOrganizeInput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const memoId = normalizeMemoId(value.memoId);
  const intent = value.intent === "polish" || value.intent === "polite" ? value.intent : null;
  const body = typeof value.body === "string" ? value.body : "";
  const title = typeof value.title === "string" ? value.title : "";

  if (!memoId || !intent) {
    return null;
  }

  return {
    memoId,
    intent,
    title,
    body
  };
}

function registerMemoHandlers(memoStore, memoSearchService, organizer, memoStoreContext) {
  ipcMain.handle(memoChannels.health, async () => {
    const baseHealth = {
      bridgeConnected: true,
      ready: true,
      storeKind: memoStoreContext.kind,
      filePath: memoStoreContext.filePath,
      fallbackReason: memoStoreContext.fallbackReason
    };

    try {
      await memoStore.list();
      return baseHealth;
    } catch (error) {
      return {
        ...baseHealth,
        ready: false,
        errorMessage: getErrorMessage(error)
      };
    }
  });

  ipcMain.handle(memoChannels.list, async () => memoStore.list());

  ipcMain.handle(memoChannels.get, async (_event, id) => {
    const memoId = normalizeMemoId(id);
    return memoId ? memoStore.get(memoId) : null;
  });

  ipcMain.handle(memoChannels.create, async (_event, input) => {
    return memoStore.create(normalizeMemoInput(input));
  });

  ipcMain.handle(memoChannels.update, async (_event, id, patch) => {
    const memoId = normalizeMemoId(id);
    return memoId ? memoStore.update(memoId, normalizeMemoInput(patch)) : null;
  });

  ipcMain.handle(memoChannels.delete, async (_event, id) => {
    const memoId = normalizeMemoId(id);
    return memoId ? memoStore.delete(memoId) : false;
  });

  ipcMain.handle(memoChannels.search, async (_event, query) => {
    const normalizedQuery = normalizeSearchQuery(query);
    return normalizedQuery ? memoSearchService.search(normalizedQuery) : [];
  });

  ipcMain.handle(memoChannels.organize, async (_event, input) => {
    const organizeInput = normalizeOrganizeInput(input);

    if (!organizeInput) {
      throw new Error("잘못된 정리 요청입니다.");
    }

    return organizer.organize(organizeInput);
  });
}

function createPrimaryMemoStore(userDataPath) {
  try {
    const memoStore = createMemoSqliteStore({
      userDataPath
    });

    return {
      store: memoStore,
      kind: "sqlite",
      filePath: memoStore.filePath,
      fallbackReason: null
    };
  } catch (error) {
    console.error("[memo-store] SQLite initialization failed. Falling back to JSON store.", error);

    const memoStore = createMemoStore({
      userDataPath
    });

    return {
      store: memoStore,
      kind: "json",
      filePath: memoStore.filePath,
      fallbackReason: getErrorMessage(error)
    };
  }
}

function createWindow() {
  const { bounds, minimumSize } = getWindowMetrics();
  const windowOptions = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
    backgroundColor: "#fcf7dd",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (process.platform === "darwin") {
    windowOptions.titleBarStyle = "hiddenInset";
  }

  const mainWindow = new BrowserWindow(windowOptions);
  const syncWindowBounds = () => fitWindowToDisplay(mainWindow);

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (!isPlaywrightE2E) {
    screen.on("display-metrics-changed", syncWindowBounds);
    screen.on("display-added", syncWindowBounds);
    screen.on("display-removed", syncWindowBounds);

    mainWindow.on("closed", () => {
      screen.off("display-metrics-changed", syncWindowBounds);
      screen.off("display-added", syncWindowBounds);
      screen.off("display-removed", syncWindowBounds);
    });
  }

  return mainWindow;
}

app.whenReady().then(() => {
  const primaryMemoStore = createPrimaryMemoStore(app.getPath("userData"));
  const memoStore = primaryMemoStore.store;
  const memoSearchService = createMemoSearchService({
    listMemos() {
      return memoStore.list();
    }
  });
  const organizer = createLocalOrganizer();

  registerMemoHandlers(memoStore, memoSearchService, organizer, primaryMemoStore);
  createWindow();

  app.on("before-quit", () => {
    if (typeof memoStore.close === "function") {
      memoStore.close();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
