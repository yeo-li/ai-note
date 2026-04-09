import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoStore } from "./memo-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
const memoStore = createMemoStore();
const memoChannels = {
  list: "memo:list",
  get: "memo:get",
  create: "memo:create",
  update: "memo:update",
  delete: "memo:delete"
};

function registerMemoHandlers() {
  ipcMain.handle(memoChannels.list, () => memoStore.list());
  ipcMain.handle(memoChannels.get, (_event, id) => memoStore.get(id));
  ipcMain.handle(memoChannels.create, (_event, input) => memoStore.create(input));
  ipcMain.handle(memoChannels.update, (_event, id, patch) => memoStore.update(id, patch));
  ipcMain.handle(memoChannels.delete, (_event, id) => memoStore.delete(id));
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
  registerMemoHandlers();
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
