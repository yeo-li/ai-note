"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const memoChannels = {
  health: "memo:health",
  list: "memo:list",
  get: "memo:get",
  create: "memo:create",
  update: "memo:update",
  delete: "memo:delete",
  listCategories: "memo:list-categories",
  createCategory: "memo:create-category",
  updateCategory: "memo:update-category",
  deleteCategory: "memo:delete-category",
  search: "memo:search",
  aiSearch: "memo:ai-search",
  organize: "memo:organize",
  compose: "memo:compose",
  categorize: "memo:categorize",
  categorizeState: "memo:categorize-state",
  categorizeAll: "memo:categorize-all",
  categorizeAllState: "memo:categorize-all-state"
};
const memoEventChannels = {
  changed: "memo:changed",
  organizeState: "memo:organize-state-changed",
  categorizeState: "memo:categorize-state-changed",
  categorizeAllState: "memo:categorize-all-state-changed",
  categoriesChanged: "memo:categories-changed"
};
const promptTemplateChannels = {
  list: "prompt-template:list",
  create: "prompt-template:create",
  update: "prompt-template:update",
  delete: "prompt-template:delete"
};
const windowChannels = {
  openStickyNote: "window:open-sticky-note",
  setStickyPinned: "window:set-sticky-pinned"
};
const quickCaptureChannels = {
  open: "window:open-quick-capture",
  close: "quick-capture:close-window"
};

const memoAPI = {
  health() {
    return ipcRenderer.invoke(memoChannels.health);
  },
  list() {
    return ipcRenderer.invoke(memoChannels.list);
  },
  get(id) {
    return ipcRenderer.invoke(memoChannels.get, id);
  },
  create(input) {
    return ipcRenderer.invoke(memoChannels.create, input);
  },
  update(id, patch) {
    return ipcRenderer.invoke(memoChannels.update, id, patch);
  },
  delete(id) {
    return ipcRenderer.invoke(memoChannels.delete, id);
  },
  listCategories() {
    return ipcRenderer.invoke(memoChannels.listCategories);
  },
  createCategory(input) {
    return ipcRenderer.invoke(memoChannels.createCategory, input);
  },
  updateCategory(categoryId, patch) {
    return ipcRenderer.invoke(memoChannels.updateCategory, categoryId, patch);
  },
  deleteCategory(categoryId) {
    return ipcRenderer.invoke(memoChannels.deleteCategory, categoryId);
  },
  search(query) {
    return ipcRenderer.invoke(memoChannels.search, query);
  },
  aiSearch(query) {
    return ipcRenderer.invoke(memoChannels.aiSearch, query);
  },
  organizeState() {
    return ipcRenderer.invoke(memoChannels.organizeState);
  },
  organize(input) {
    return ipcRenderer.invoke(memoChannels.organize, input);
  },
  compose(input) {
    return ipcRenderer.invoke(memoChannels.compose, input);
  },
  categorizeState() {
    return ipcRenderer.invoke(memoChannels.categorizeState);
  },
  categorize(memoId) {
    return ipcRenderer.invoke(memoChannels.categorize, memoId);
  },
  categorizeAllState() {
    return ipcRenderer.invoke(memoChannels.categorizeAllState);
  },
  categorizeAll() {
    return ipcRenderer.invoke(memoChannels.categorizeAll);
  },
  onDidChange(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const wrappedListener = (_event, changeEvent) => {
      listener(changeEvent);
    };

    ipcRenderer.on(memoEventChannels.changed, wrappedListener);

    return () => {
      ipcRenderer.off(memoEventChannels.changed, wrappedListener);
    };
  },
  onDidOrganizeState(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const wrappedListener = (_event, changeEvent) => {
      listener(changeEvent);
    };

    ipcRenderer.on(memoEventChannels.organizeState, wrappedListener);

    return () => {
      ipcRenderer.off(memoEventChannels.organizeState, wrappedListener);
    };
  },
  onDidCategorizeState(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const wrappedListener = (_event, changeEvent) => {
      listener(changeEvent);
    };

    ipcRenderer.on(memoEventChannels.categorizeState, wrappedListener);

    return () => {
      ipcRenderer.off(memoEventChannels.categorizeState, wrappedListener);
    };
  },
  onDidCategorizeAllState(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const wrappedListener = (_event, busy) => {
      listener(busy);
    };

    ipcRenderer.on(memoEventChannels.categorizeAllState, wrappedListener);

    return () => {
      ipcRenderer.off(memoEventChannels.categorizeAllState, wrappedListener);
    };
  },
  onDidCategoriesChange(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }

    const wrappedListener = (_event, categories) => {
      listener(categories);
    };

    ipcRenderer.on(memoEventChannels.categoriesChanged, wrappedListener);

    return () => {
      ipcRenderer.off(memoEventChannels.categoriesChanged, wrappedListener);
    };
  }
};

const promptTemplateAPI = {
  list() {
    return ipcRenderer.invoke(promptTemplateChannels.list);
  },
  create(input) {
    return ipcRenderer.invoke(promptTemplateChannels.create, input);
  },
  update(id, patch) {
    return ipcRenderer.invoke(promptTemplateChannels.update, id, patch);
  },
  delete(id) {
    return ipcRenderer.invoke(promptTemplateChannels.delete, id);
  }
};

contextBridge.exposeInMainWorld("desktopAPI", {
  platform: process.platform,
  window: {
    openStickyNote(noteId) {
      return ipcRenderer.invoke(windowChannels.openStickyNote, typeof noteId === "string" ? noteId : null);
    },
    setStickyPinned(pinned) {
      return ipcRenderer.invoke(windowChannels.setStickyPinned, Boolean(pinned));
    },
    openQuickCapture() {
      return ipcRenderer.invoke(quickCaptureChannels.open);
    },
    closeQuickCapture() {
      return ipcRenderer.invoke(quickCaptureChannels.close);
    }
  },
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

contextBridge.exposeInMainWorld("memoAPI", memoAPI);
contextBridge.exposeInMainWorld("promptTemplateAPI", promptTemplateAPI);
