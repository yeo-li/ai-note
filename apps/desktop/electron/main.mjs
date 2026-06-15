import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { memoChannels } from "./memo-channels.mjs";
import { promptTemplateChannels } from "./prompt-template-channels.mjs";
import { quickCaptureChannels } from "./quick-capture-channels.mjs";
import { createMemoSearchService } from "./search/memo-search-service.mjs";
import { createContextSearchService } from "./search/context-search-service.mjs";
import { createComposeService, normalizeComposeInput } from "./compose/compose-service.mjs";
import { createAiMemoProvider } from "./ai-memo-provider.mjs";
import { createLocalOrganizer } from "./organize/local-organizer.mjs";
import { createGeminiApiOrganizeProvider } from "./organize/gemini-api-organizer.mjs";
import { createOrganizeOrchestrator } from "./organize/organize-orchestrator.mjs";
import { createMemoStore } from "./store/memo-store.mjs";
import { createMemoSqliteStore } from "./store/memo-sqlite-store.mjs";
import { createMemoSyncQueue, MEMO_SYNC_QUEUE_FILENAME } from "./store/memo-sync-queue.mjs";
import { createMemoSyncStore } from "./store/memo-sync-store.mjs";
import { createMemoServerClient, defaultMemoServerUrl } from "./memo-server-client.mjs";
import { createPromptTemplateStore } from "./store/prompt-template-store.mjs";
import { normalizeMemoCategoryDescription, normalizeMemoCategoryValue } from "@ai-note/shared/memo";

const __dirname = dirname(fileURLToPath(import.meta.url));

// apps/desktop/.env에서 환경변수 로드 (파일이 있을 때만)
const envFilePath = resolve(__dirname, "../.env");
if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}
const rendererUrl = process.env.VITE_DEV_SERVER_URL;
const rendererPath = join(__dirname, "../dist/index.html");
const windowIconPath = join(__dirname, "assets/window-icon.png");
const trayIconPath = join(__dirname, "assets/trayIconTemplate.png");

let appTray = null;
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
const quickCaptureWindowSize = {
  width: 360,
  height: 200
};
const quickCaptureShortcut = "CommandOrControl+Shift+N";
const isPlaywrightE2E = process.env.PLAYWRIGHT_E2E === "1";
const userDataPathOverride = process.env.AI_NOTE_USER_DATA_PATH;
const memoEventChannels = {
  changed: "memo:changed",
  organizeState: "memo:organize-state-changed",
  categorizeState: "memo:categorize-state-changed",
  categorizeAllState: "memo:categorize-all-state-changed",
  categoriesChanged: "memo:categories-changed"
};
const organizingMemoIds = new Set();
const composingMemoIds = new Set();
const categorizingMemoIds = new Set();
let isCategorizingAll = false;

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

  const input = {};

  if (typeof value.title === "string") {
    input.title = value.title;
  }

  if (typeof value.body === "string") {
    input.body = value.body;
  }

  if (typeof value.favorite === "boolean") {
    input.favorite = value.favorite;
  }

  if (Object.prototype.hasOwnProperty.call(value, "category")) {
    const category = normalizeMemoCategoryInput(value.category);

    if (typeof category !== "undefined") {
      input.category = category;
    }
  }

  return input;
}

function guessMemoCategory(text) {
  const normalizedText = text.toLowerCase();

  if (/(todo|할 ?일|해야|마감|체크리스트)/.test(normalizedText)) {
    return "task";
  }

  if (/(아이디어|구상|기획|brainstorm|idea)/.test(normalizedText)) {
    return "idea";
  }

  if (/(오늘|회고|일기|느낀|journal)/.test(normalizedText)) {
    return "journal";
  }

  if (/(참고|링크|reference|자료|정보)/.test(normalizedText)) {
    return "reference";
  }

  return "other";
}

function normalizeMemoCategoryInput(value) {
  if (value === null) {
    return null;
  }

  const category = normalizeMemoCategoryValue(value);
  return category && category !== "all" ? category : undefined;
}

function normalizeMemoCategoryCreateInput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const label = normalizeMemoCategoryValue(value.label);

  if (!label || label === "all") {
    return null;
  }

  return { label, description: normalizeMemoCategoryDescription(value.description) };
}

function normalizeMemoCategoryUpdateInput(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const patch = {};

  if (typeof value.label === "string") {
    patch.label = value.label;
  }

  if (typeof value.description === "string") {
    patch.description = value.description;
  }

  return patch;
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

function broadcastCategorizeStateChange(changeEvent) {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) {
      continue;
    }

    const { webContents } = browserWindow;

    if (webContents.isDestroyed()) {
      continue;
    }

    webContents.send(memoEventChannels.categorizeState, changeEvent);
  }
}

function broadcastCategoriesChanged(categories) {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) {
      continue;
    }

    const { webContents } = browserWindow;

    if (webContents.isDestroyed()) {
      continue;
    }

    webContents.send(memoEventChannels.categoriesChanged, categories);
  }
}

function broadcastCategorizeAllStateChange(busy) {
  for (const browserWindow of BrowserWindow.getAllWindows()) {
    if (browserWindow.isDestroyed()) {
      continue;
    }

    const { webContents } = browserWindow;

    if (webContents.isDestroyed()) {
      continue;
    }

    webContents.send(memoEventChannels.categorizeAllState, busy);
  }
}

async function applyAiCategorization(memoStore, aiMemoProvider, memo, event) {
  const memoId = memo.id;

  categorizingMemoIds.add(memoId);
  broadcastCategorizeStateChange({ memoId, busy: true });

  try {
    const categories = await memoStore.listCategories();
    const result = await aiMemoProvider.categorizeMemo({ title: memo.title, body: memo.body, categories });
    let categoryId;

    if (result.isNewCategory) {
      categoryId = normalizeMemoCategoryValue(result.newCategoryLabel);

      try {
        await memoStore.createCategory({ label: result.newCategoryLabel, description: result.newCategoryDescription });
        broadcastCategoriesChanged(await memoStore.listCategories());
      } catch {
        // 비슷한 카테고리가 이미 있으면 정규화된 이름을 그대로 카테고리로 사용
      }
    } else {
      categoryId = result.categoryId;
    }

    const updatedMemo = await memoStore.update(memoId, { category: categoryId });

    if (updatedMemo) {
      broadcastMemoChange(event, {
        type: "updated",
        memo: updatedMemo
      });
    }

    return updatedMemo;
  } finally {
    categorizingMemoIds.delete(memoId);
    broadcastCategorizeStateChange({ memoId, busy: false });
  }
}

async function applyAiCategorizationBatch(memoStore, aiMemoProvider, memos, event) {
  for (const memo of memos) {
    categorizingMemoIds.add(memo.id);
    broadcastCategorizeStateChange({ memoId: memo.id, busy: true });
  }

  try {
    const categories = await memoStore.listCategories();
    const results = await aiMemoProvider.categorizeMemos({
      memos: memos.map((memo) => ({ id: memo.id, title: memo.title, body: memo.body })),
      categories
    });

    const newCategoryIdsByLabel = new Map();

    for (const result of results) {
      if (!result?.isNewCategory) {
        continue;
      }

      const normalizedLabel = normalizeMemoCategoryValue(result.newCategoryLabel);

      if (!normalizedLabel || newCategoryIdsByLabel.has(normalizedLabel)) {
        continue;
      }

      try {
        const createdCategory = await memoStore.createCategory({ label: result.newCategoryLabel, description: result.newCategoryDescription });
        newCategoryIdsByLabel.set(normalizedLabel, createdCategory.id);
      } catch {
        // 비슷한 카테고리가 이미 있으면 정규화된 이름을 그대로 카테고리로 사용
        newCategoryIdsByLabel.set(normalizedLabel, normalizedLabel);
      }
    }

    if (newCategoryIdsByLabel.size > 0) {
      broadcastCategoriesChanged(await memoStore.listCategories());
    }

    const updatedMemos = [];

    for (let index = 0; index < memos.length; index += 1) {
      const result = results[index];

      if (!result) {
        continue;
      }

      const categoryId = result.isNewCategory ? newCategoryIdsByLabel.get(normalizeMemoCategoryValue(result.newCategoryLabel)) : result.categoryId;

      if (!categoryId) {
        continue;
      }

      const updatedMemo = await memoStore.update(memos[index].id, { category: categoryId });

      if (updatedMemo) {
        broadcastMemoChange(event, { type: "updated", memo: updatedMemo });
        updatedMemos.push(updatedMemo);
      }
    }

    return updatedMemos;
  } finally {
    for (const memo of memos) {
      categorizingMemoIds.delete(memo.id);
      broadcastCategorizeStateChange({ memoId: memo.id, busy: false });
    }
  }
}

function registerMemoHandlers(memoStore, memoSearchService, organizer, aiMemoProvider, memoStoreContext, contextSearchService, composeService) {
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

    if (!createdMemo.category) {
      void applyAiCategorization(memoStore, aiMemoProvider, createdMemo, undefined).catch(() => {});
    }

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

  ipcMain.handle(memoChannels.listCategories, async () => memoStore.listCategories());

  ipcMain.handle(memoChannels.createCategory, async (_event, input) => {
    const categoryInput = normalizeMemoCategoryCreateInput(input);

    if (!categoryInput) {
      throw new Error("카테고리 이름을 확인해 주세요.");
    }

    const createdCategory = await memoStore.createCategory(categoryInput);
    broadcastCategoriesChanged(await memoStore.listCategories());
    return createdCategory;
  });

  ipcMain.handle(memoChannels.updateCategory, async (_event, id, patch) => {
    const categoryId = normalizeMemoCategoryValue(id);

    if (!categoryId) {
      throw new Error("잘못된 카테고리 요청입니다.");
    }

    const updatedCategory = await memoStore.updateCategory(categoryId, normalizeMemoCategoryUpdateInput(patch));
    broadcastCategoriesChanged(await memoStore.listCategories());
    return updatedCategory;
  });

  ipcMain.handle(memoChannels.deleteCategory, async (_event, id) => {
    const categoryId = normalizeMemoCategoryValue(id);

    if (!categoryId) {
      throw new Error("잘못된 카테고리 요청입니다.");
    }

    const { category, updatedMemos } = await memoStore.deleteCategory(categoryId);

    if (!category) {
      return null;
    }

    for (const updatedMemo of updatedMemos) {
      broadcastMemoChange(undefined, { type: "updated", memo: updatedMemo });
    }

    broadcastCategoriesChanged(await memoStore.listCategories());
    return category;
  });

  ipcMain.handle(memoChannels.search, async (_event, query) => {
    const normalizedQuery = normalizeSearchQuery(query);
    return normalizedQuery ? memoSearchService.search(normalizedQuery) : [];
  });

  ipcMain.handle(memoChannels.aiSearch, async (_event, query) => {
    const normalizedQuery = normalizeSearchQuery(query);
    return normalizedQuery ? contextSearchService.search(normalizedQuery) : [];
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

  ipcMain.handle(memoChannels.categorizeState, async () => Array.from(categorizingMemoIds));

  ipcMain.handle(memoChannels.categorize, async (event, id) => {
    const memoId = normalizeMemoId(id);

    if (!memoId) {
      throw new Error("잘못된 분류 요청입니다.");
    }

    const memo = await memoStore.get(memoId);

    if (!memo) {
      throw new Error("메모를 찾지 못했어요.");
    }

    if (!memo.body.trim()) {
      return memo;
    }

    return applyAiCategorization(memoStore, aiMemoProvider, memo, event);
  });

  ipcMain.handle(memoChannels.categorizeAllState, async () => isCategorizingAll);

  ipcMain.handle(memoChannels.categorizeAll, async (event) => {
    if (isCategorizingAll) {
      return { processed: 0, updated: 0, memos: [] };
    }

    isCategorizingAll = true;
    broadcastCategorizeAllStateChange(true);

    try {
      const memos = await memoStore.list();
      const targetMemos = memos.filter((memo) => !memo.category && memo.body.trim().length > 0);

      if (targetMemos.length === 0) {
        return { processed: 0, updated: 0, memos: [] };
      }

      const updatedMemos = await applyAiCategorizationBatch(memoStore, aiMemoProvider, targetMemos, event);

      return { processed: targetMemos.length, updated: updatedMemos.length, memos: updatedMemos };
    } finally {
      isCategorizingAll = false;
      broadcastCategorizeAllStateChange(false);
    }
  });

  ipcMain.handle("memo:compose", async (_event, input) => {
    const composeInput = normalizeComposeInput(input);

    if (!composeInput) {
      throw new Error("잘못된 메모 조합 요청입니다.");
    }

    return composeService.compose(composeInput);
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

  if (organizeProvider === "api" || !organizeProvider) {
    return createOrganizeOrchestrator({
      provider: createGeminiApiOrganizeProvider(),
      fallbackProvider: localOrganizer
    });
  }

  return localOrganizer;
}

function loadRendererWindow(windowInstance, { stickyMode = false, quickCaptureMode = false, noteId = null } = {}) {
  const query = new URLSearchParams();

  if (stickyMode) {
    query.set("view", "sticky");
  }

  if (quickCaptureMode) {
    query.set("view", "quick-capture");
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
    icon: windowIconPath,
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
    icon: windowIconPath,
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

function createQuickCaptureWindow() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const baseDisplay = focusedWindow
    ? screen.getDisplayMatching(focusedWindow.getBounds())
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = baseDisplay.workArea;
  const width = Math.min(quickCaptureWindowSize.width, workArea.width);
  const height = Math.min(quickCaptureWindowSize.height, workArea.height);
  const x = workArea.x + Math.floor((workArea.width - width) / 2);
  const y = workArea.y + Math.floor((workArea.height - height) / 3);

  const windowOptions = {
    x,
    y,
    width,
    height,
    icon: windowIconPath,
    backgroundColor: "#fffdf9",
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  };

  const quickCaptureWindow = new BrowserWindow(windowOptions);
  quickCaptureWindow.setAlwaysOnTop(true, "floating");
  quickCaptureWindow.once("ready-to-show", () => {
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
  });

  void loadRendererWindow(quickCaptureWindow, { quickCaptureMode: true });
  attachExternalLinkHandler(quickCaptureWindow);

  return quickCaptureWindow;
}

function createAppTray(openQuickCaptureWindow) {
  const trayIcon = nativeImage.createFromPath(trayIconPath);
  trayIcon.setTemplateImage(true);
  const tray = new Tray(trayIcon);

  const trayMenu = Menu.buildFromTemplate([
    {
      label: "빠른 메모 작성",
      click: () => openQuickCaptureWindow()
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => app.quit()
    }
  ]);

  tray.setToolTip("AI 메모장");
  tray.on("click", () => openQuickCaptureWindow());
  tray.on("right-click", () => tray.popUpContextMenu(trayMenu));

  return tray;
}

app.whenReady().then(() => {
  const primaryMemoStore = createPrimaryMemoStore(app.getPath("userData"));
  const memoServerClient = createMemoServerClient({
    baseUrl: process.env.AI_NOTE_MEMO_SERVER_URL?.trim() || defaultMemoServerUrl
  });
  const memoSyncQueue = createMemoSyncQueue({
    filePath: join(app.getPath("userData"), MEMO_SYNC_QUEUE_FILENAME)
  });
  const memoStore = createMemoSyncStore({
    memoStore: primaryMemoStore.store,
    serverClient: memoServerClient,
    queue: memoSyncQueue
  });

  memoStore.pullFromServer().catch((error) => {
    console.error("[memo-store] Failed to pull memos from server.", error);
  });

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
              "정리한 메모",
              "",
              `- ${firstMemo.body.trim().split(/\n+/)[0] ?? firstMemo.title}`,
              "",
              "관련 내용",
              `- ${firstMemo.body.trim()}`,
              ...restMemos.map((memo) => `- ${memo.body.trim()}`),
              "",
              "다음 행동",
              `- 관련 메모 ${selectedMemos.length}개를 기준으로 필요한 항목을 확인합니다.`,
              "",
              ...selectedMemos.map((memo) => memo.body.trim())
            ].join("\n"),
            sourceMemoIds: selectedMemos.map((memo) => memo.id)
          };
        },
        async categorizeMemo({ title, body }) {
          return { categoryId: guessMemoCategory(`${title} ${body}`), isNewCategory: false };
        }
      }
    : createAiMemoProvider();

  const contextSearchService = createContextSearchService({
    listMemos: () => memoStore.list(),
    listCategories: () => memoStore.listCategories(),
    aiMemoProvider
  });
  const composeService = createComposeService({
    listMemos: () => memoStore.list(),
    aiMemoProvider,
    onMemoBusyChange: (memoId, busy) => {
      if (busy) {
        composingMemoIds.add(memoId);
      } else {
        composingMemoIds.delete(memoId);
      }

      broadcastOrganizeStateChange({ memoId, busy });
    }
  });

  registerMemoHandlers(memoStore, memoSearchService, organizer, aiMemoProvider, primaryMemoStore, contextSearchService, composeService);
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

  let mainWindow = null;
  let activeQuickCaptureWindow = null;

  function openQuickCaptureWindow() {
    if (activeQuickCaptureWindow && !activeQuickCaptureWindow.isDestroyed()) {
      if (activeQuickCaptureWindow.isMinimized()) {
        activeQuickCaptureWindow.restore();
      }

      activeQuickCaptureWindow.focus();
      return;
    }

    const shouldRestoreBackground = Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible());

    activeQuickCaptureWindow = createQuickCaptureWindow();
    activeQuickCaptureWindow.on("closed", () => {
      activeQuickCaptureWindow = null;

      if (!shouldRestoreBackground || !mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      if (process.platform === "darwin") {
        app.hide();
      } else if (!mainWindow.isMinimized()) {
        mainWindow.minimize();
      }
    });
  }

  ipcMain.handle(quickCaptureChannels.open, () => {
    openQuickCaptureWindow();
    return true;
  });

  ipcMain.handle(quickCaptureChannels.close, (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.close();
    }

    return true;
  });

  if (!isPlaywrightE2E) {
    const shortcutRegistered = globalShortcut.register(quickCaptureShortcut, openQuickCaptureWindow);

    if (!shortcutRegistered) {
      console.error("[quick-capture] 전역 단축키 등록에 실패했습니다.", quickCaptureShortcut);
    }

    appTray = createAppTray(openQuickCaptureWindow);
  }

  mainWindow = createWindow();

  app.on("before-quit", () => {
    globalShortcut.unregisterAll();

    if (appTray) {
      appTray.destroy();
      appTray = null;
    }

    if (typeof memoStore.close === "function") {
      memoStore.close();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
