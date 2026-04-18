import { app, BrowserWindow, screen, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
const defaultMinimumSize = {
  width: 640,
  height: 720
};
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === "1";

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

function createWindow() {
  const { bounds, minimumSize } = getWindowMetrics();
  const windowOptions = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
    backgroundColor: "#f6f9fc",
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
