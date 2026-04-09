import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { memoChannels } from "./memo-channels.mjs";
import { createLocalOrganizer } from "./organize/local-organizer.mjs";
import { createMemoStore } from "./store/memo-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
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

function registerMemoHandlers(memoStore, organizer) {
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

  ipcMain.handle(memoChannels.organize, async (_event, input) => {
    const organizeInput = normalizeOrganizeInput(input);

    if (!organizeInput) {
      throw new Error("Invalid organize request.");
    }

    return organizer.organize(organizeInput);
  });
}

function createWindow() {
  const windowOptions = {
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#f2ede5",
    webPreferences: {
      preload: join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  if (process.platform === "darwin") {
    windowOptions.titleBarStyle = "hiddenInset";
  }

  const mainWindow = new BrowserWindow(windowOptions);

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
  } else {
    mainWindow.loadFile(rendererPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  const memoStore = createMemoStore({
    userDataPath: app.getPath("userData")
  });
  const organizer = createLocalOrganizer();

  registerMemoHandlers(memoStore, organizer);
  createWindow();

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
