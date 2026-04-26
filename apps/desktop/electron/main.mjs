import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { memoChannels } from "./memo-channels.mjs";
import { promptTemplateChannels } from "./prompt-template-channels.mjs";
import { createMemoSearchService } from "./search/memo-search-service.mjs";
import { createAiMemoProvider } from "./ai-memo-provider.mjs";
import { createLocalOrganizer } from "./organize/local-organizer.mjs";
import { createCodexCliOrganizeProvider } from "./organize/codex-cli-organizer.mjs";
import { createOrganizeOrchestrator } from "./organize/organize-orchestrator.mjs";
import { createMemoStore } from "./store/memo-store.mjs";
import { createMemoSqliteStore } from "./store/memo-sqlite-store.mjs";
import { createPromptTemplateStore } from "./store/prompt-template-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
const defaultMinimumSize = {
  width: 640,
  height: 720
};
const stickyWindowDefaultSize = {
  width: 520,
  height: 760
};
const stickyWindowMinimumSize = {
  width: 360,
  height: 480
};
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === "1";
const userDataPathOverride = process.env.AI_NOTE_USER_DATA_PATH;
const memoEventChannels = {
  changed: "memo:changed",
  organizeState: "memo:organize-state-changed"
};
const organizingMemoIds = new Set();
const composingMemoIds = new Set();

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

function getWindowMetrics(display = screen.getPrimaryDisplay(), minimumSizeBase = defaultMinimumSize) {
  const bounds = getTestWindowBounds(display.workArea) ?? display.workArea;

  return {
    bounds,
    minimumSize: {
      width: Math.min(minimumSizeBase.width, bounds.width),
      height: Math.min(minimumSizeBase.height, bounds.height)
    }
  };
}

function fitWindowToDisplay(mainWindow, minimumSizeBase = defaultMinimumSize) {
  const targetDisplay = screen.getDisplayMatching(mainWindow.getBounds());
  const { bounds, minimumSize } = getWindowMetrics(targetDisplay, minimumSizeBase);

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
    body: typeof value.body === "string" ? value.body : undefined,
    favorite: typeof value.favorite === "boolean" ? value.favorite : undefined
  };
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizePromptTemplateInput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";

  if (!name || !prompt) {
    return null;
  }

  return {
    name,
    prompt
  };
}

function normalizePromptTemplatePatch(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const patch = {};

  if (typeof value.name === "string") {
    patch.name = value.name.trim();
  }

  if (typeof value.prompt === "string") {
    patch.prompt = value.prompt.trim();
  }

  return patch;
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
  const prompt = typeof value.prompt === "string" ? value.prompt : "";

  if (!memoId || !intent) {
    return null;
  }

  return {
    memoId,
    intent,
    title,
    body,
    prompt
  };
}

function normalizeComposeInput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  const intent = value.intent === "polish" || value.intent === "polite" ? value.intent : null;

  if (!prompt || !intent) {
    return null;
  }

  return {
    prompt,
    intent
  };
}

function createComposeRefusal({ refusalReason, message, relatedMemoIds = [] }) {
  return {
    kind: "refused",
    refusalReason,
    message,
    relatedMemoIds,
    relatedCount: relatedMemoIds.length
  };
}

function broadcastMemoChange(event, changeEvent) {
  const sourceWebContentsId = event?.sender?.id;

  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) {
      continue;
    }

    const { webContents } = browserWindow;

    if (webContents.isDestroyed()) {
      continue;
    }

    if (sourceWebContentsId === webContents.id) {
      continue;
    }

    webContents.send(memoEventChannels.changed, changeEvent);
  }
}

function broadcastOrganizeStateChange(changeEvent) {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) {
      continue;
    }

    const { webContents } = browserWindow;

    if (webContents.isDestroyed()) {
      continue;
    }

    webContents.send(memoEventChannels.organizeState, changeEvent);
  }
}

function registerMemoHandlers(memoStore, memoSearchService, organizer, aiMemoProvider, memoStoreContext) {
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

  ipcMain.handle(memoChannels.create, async (event, input) => {
    const createdMemo = await memoStore.create(normalizeMemoInput(input));

    broadcastMemoChange(event, {
      type: "created",
      memo: createdMemo
    });

    return createdMemo;
  });

  ipcMain.handle(memoChannels.update, async (event, id, patch) => {
    const memoId = normalizeMemoId(id);

    if (!memoId) {
      return null;
    }

    const updatedMemo = await memoStore.update(memoId, normalizeMemoInput(patch));

    if (updatedMemo) {
      broadcastMemoChange(event, {
        type: "updated",
        memo: updatedMemo
      });
    }

    return updatedMemo;
  });

  ipcMain.handle(memoChannels.delete, async (event, id) => {
    const memoId = normalizeMemoId(id);

    if (!memoId) {
      return false;
    }

    const deleted = await memoStore.delete(memoId);

    if (deleted) {
      broadcastMemoChange(event, {
        type: "deleted",
        memoId
      });
    }

    return deleted;
  });

  ipcMain.handle(memoChannels.search, async (_event, query) => {
    const normalizedQuery = normalizeSearchQuery(query);
    return normalizedQuery ? memoSearchService.search(normalizedQuery) : [];
  });

  ipcMain.handle(memoChannels.aiSearch, async (_event, query) => {
    const normalizedQuery = normalizeSearchQuery(query);

    if (!normalizedQuery) {
      return [];
    }

    const memos = await memoStore.list();
    const memoIds = await aiMemoProvider.searchMemos({
      query: normalizedQuery,
      memos
    });
    const memoMap = new Map(memos.map((memo) => [memo.id, memo]));

    return memoIds.map((memoId) => memoMap.get(memoId)).filter(Boolean);
  });

  ipcMain.handle(memoChannels.organizeState, async () => Array.from(organizingMemoIds));

  ipcMain.handle(memoChannels.organize, async (_event, input) => {
    const organizeInput = normalizeOrganizeInput(input);

    if (!organizeInput) {
      throw new Error("잘못된 정리 요청입니다.");
    }

    organizingMemoIds.add(organizeInput.memoId);
    broadcastOrganizeStateChange({ memoId: organizeInput.memoId, busy: true });

    try {
      return await organizer.organize(organizeInput);
    } finally {
      organizingMemoIds.delete(organizeInput.memoId);
      broadcastOrganizeStateChange({ memoId: organizeInput.memoId, busy: false });
    }
  });

  ipcMain.handle("memo:compose", async (_event, input) => {
    const composeInput = normalizeComposeInput(input);

    if (!composeInput) {
      throw new Error("잘못된 메모 조합 요청입니다.");
    }

    const memos = await memoStore.list();
    const busyMemoIds = [];

    try {
      if (memos.length === 0) {
        return createComposeRefusal({
          refusalReason: "no_related_memos",
          message: "작성된 메모가 없어 조합할 수 없어요. 먼저 관련 메모를 남겨 주세요."
        });
      }

      const relatedMemoIds = await aiMemoProvider.searchMemos({
        query: composeInput.prompt,
        memos
      });
      const memoMap = new Map(memos.map((memo) => [memo.id, memo]));
      const relatedMemos = relatedMemoIds.map((memoId) => memoMap.get(memoId)).filter(Boolean);
      const relatedMemoIdSet = new Set(relatedMemos.map((memo) => memo.id));

      if (relatedMemos.length === 0) {
        return createComposeRefusal({
          refusalReason: "no_related_memos",
          message: "관련 메모를 찾지 못해 새 메모를 만들지 않았어요. 프롬프트를 더 구체적으로 적어 주세요.",
          relatedMemoIds: []
        });
      }

      relatedMemos.forEach((memo) => {
        composingMemoIds.add(memo.id);
        busyMemoIds.push(memo.id);
        broadcastOrganizeStateChange({ memoId: memo.id, busy: true });
      });

      const result = await aiMemoProvider.composeMemos({
        prompt: composeInput.prompt,
        memos: relatedMemos
      });

      if (result.kind === "refused") {
        return createComposeRefusal({
          refusalReason: "insufficient_support",
          message: result.message,
          relatedMemoIds: relatedMemos.map((memo) => memo.id)
        });
      }

      const sourceMemoIds = result.sourceMemoIds.filter((memoId) => relatedMemoIdSet.has(memoId));

      if (sourceMemoIds.length === 0) {
        return createComposeRefusal({
          refusalReason: "insufficient_support",
          message: "관련 메모는 찾았지만 근거가 충분하지 않아 새 메모를 만들지 않았어요.",
          relatedMemoIds: relatedMemos.map((memo) => memo.id)
        });
      }

      return {
        kind: "composed",
        title: result.title,
        body: result.body,
        relatedMemoIds: relatedMemos.map((memo) => memo.id),
        relatedCount: relatedMemos.length,
        sourceMemoIds,
        sourceCount: sourceMemoIds.length
      };
    } finally {
      busyMemoIds.forEach((memoId) => {
        composingMemoIds.delete(memoId);
        broadcastOrganizeStateChange({ memoId, busy: false });
      });
    }
  });
}

function registerPromptTemplateHandlers(promptTemplateStore) {
  ipcMain.handle(promptTemplateChannels.list, async () => promptTemplateStore.list());

  ipcMain.handle(promptTemplateChannels.create, async (_event, input) => {
    const normalizedInput = normalizePromptTemplateInput(input);

    if (!normalizedInput) {
      throw new Error("잘못된 프롬프트 템플릿입니다.");
    }

    return promptTemplateStore.create(normalizedInput);
  });

  ipcMain.handle(promptTemplateChannels.update, async (_event, id, patch) => {
    const templateId = normalizeMemoId(id);

    if (!templateId) {
      return null;
    }

    return promptTemplateStore.update(templateId, normalizePromptTemplatePatch(patch));
  });

  ipcMain.handle(promptTemplateChannels.delete, async (_event, id) => {
    const templateId = normalizeMemoId(id);

    if (!templateId) {
      return false;
    }

    return promptTemplateStore.delete(templateId);
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

function createOrganizerForEnvironment() {
  const organizeProvider = process.env.AI_NOTE_ORGANIZE_PROVIDER?.trim().toLowerCase();
  const localOrganizer = createLocalOrganizer({
    delayMs: isPlaywrightE2E ? 900 : 0
  });

  if (organizeProvider === "local" || isPlaywrightE2E) {
    return localOrganizer;
  }

  if (organizeProvider === "codex" || !organizeProvider) {
    return createOrganizeOrchestrator({
      provider: createCodexCliOrganizeProvider(),
      fallbackProvider: localOrganizer
    });
  }

  return localOrganizer;
}

function loadRendererWindow(windowInstance, { stickyMode = false, noteId = null } = {}) {
  const query = new URLSearchParams();

  if (stickyMode) {
    query.set("view", "sticky");
  }

  if (typeof noteId === "string" && noteId.trim().length > 0) {
    query.set("noteId", noteId.trim());
  }

  if (rendererUrl) {
    const targetUrl = query.size > 0 ? `${rendererUrl}?${query.toString()}` : rendererUrl;
    return windowInstance.loadURL(targetUrl);
  }

  if (query.size > 0) {
    const queryObject = Object.fromEntries(query.entries());
    return windowInstance.loadFile(rendererPath, { query: queryObject });
  }

  return windowInstance.loadFile(rendererPath);
}

function attachExternalLinkHandler(windowInstance) {
  windowInstance.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createWindow() {
  const { bounds, minimumSize } = getWindowMetrics(undefined, defaultMinimumSize);
  const windowOptions = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
    backgroundColor: "#ffffff",
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
  const syncWindowBounds = () => fitWindowToDisplay(mainWindow, defaultMinimumSize);

  void loadRendererWindow(mainWindow);
  attachExternalLinkHandler(mainWindow);

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

function createStickyNoteWindow(noteId = null) {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const baseDisplay = focusedWindow
    ? screen.getDisplayMatching(focusedWindow.getBounds())
    : screen.getPrimaryDisplay();
  const workArea = baseDisplay.workArea;
  const width = Math.min(stickyWindowDefaultSize.width, workArea.width);
  const height = Math.min(stickyWindowDefaultSize.height, workArea.height);
  const focusedBounds = focusedWindow?.getBounds();
  const rawX = focusedBounds ? focusedBounds.x + 48 : workArea.x + Math.floor((workArea.width - width) / 2);
  const rawY = focusedBounds ? focusedBounds.y + 48 : workArea.y + Math.floor((workArea.height - height) / 2);
  const x = Math.min(Math.max(rawX, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(rawY, workArea.y), workArea.y + workArea.height - height);

  const windowOptions = {
    x,
    y,
    width,
    height,
    minWidth: Math.min(stickyWindowMinimumSize.width, workArea.width),
    minHeight: Math.min(stickyWindowMinimumSize.height, workArea.height),
    backgroundColor: "#f4f4f7",
    frame: false,
    autoHideMenuBar: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  const stickyWindow = new BrowserWindow(windowOptions);

  void loadRendererWindow(stickyWindow, {
    stickyMode: true,
    noteId
  });
  attachExternalLinkHandler(stickyWindow);

  return stickyWindow;
}

app.whenReady().then(() => {
  const primaryMemoStore = createPrimaryMemoStore(app.getPath("userData"));
  const memoStore = primaryMemoStore.store;
  const promptTemplateStore = createPromptTemplateStore({
    userDataPath: app.getPath("userData")
  });
  const memoSearchService = createMemoSearchService({
    listMemos() {
      return memoStore.list();
    }
  });
  const organizer = createOrganizerForEnvironment();
  const aiMemoProvider = isPlaywrightE2E
    ? {
        async searchMemos({ query, memos }) {
          const normalizedQuery = query.toLowerCase();

          return memos
            .filter((memo) => `${memo.title} ${memo.body}`.toLowerCase().includes(normalizedQuery.split(/\s+/).find(Boolean) ?? normalizedQuery))
            .map((memo) => memo.id);
        },
        async composeMemos({ prompt, memos }) {
          const selectedMemos = memos.slice(0, Math.min(memos.length, 3));

          if (selectedMemos.length === 0) {
            return {
              kind: "refused",
              message: "관련 메모를 찾지 못해 새 메모를 만들지 않았어요."
            };
          }

          if (selectedMemos.length === 1) {
            return {
              kind: "refused",
              message: "관련 메모는 찾았지만 근거가 충분하지 않아 새 메모를 만들지 않았어요."
            };
          }

          const [firstMemo, ...restMemos] = selectedMemos;

          return {
            kind: "composed",
            title: prompt.length > 18 ? `${prompt.slice(0, 18).trim()}…` : prompt,
            body: [
              "한 줄 결론",
              `- ${firstMemo.body.trim().split(/\n+/)[0] ?? firstMemo.title}`,
              "",
              "개선 전/후 차이",
              `- 전: ${firstMemo.body.trim()}`,
              ...restMemos.map((memo, index) => `- 후 ${index + 1}: ${memo.body.trim()}`),
              "",
              "검증 방법",
              `- 아래에 정리된 관련 메모 ${selectedMemos.length}개의 표현과 일치하는지 확인합니다.`,
              "",
              ...selectedMemos.map((memo) => memo.body.trim())
            ].join("\n"),
            sourceMemoIds: selectedMemos.map((memo) => memo.id)
          };
        }
      }
    : createAiMemoProvider({
        cwd: app.getAppPath()
      });

  registerMemoHandlers(memoStore, memoSearchService, organizer, aiMemoProvider, primaryMemoStore);
  registerPromptTemplateHandlers(promptTemplateStore);
  ipcMain.handle("window:open-sticky-note", (_event, noteId) => {
    createStickyNoteWindow(typeof noteId === "string" ? noteId : null);
    return true;
  });
  ipcMain.handle("window:set-sticky-pinned", (event, pinned) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (!targetWindow) {
      return false;
    }

    const shouldPin = Boolean(pinned);
    targetWindow.setAlwaysOnTop(shouldPin, shouldPin ? "floating" : "normal");

    return targetWindow.isAlwaysOnTop();
  });

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
