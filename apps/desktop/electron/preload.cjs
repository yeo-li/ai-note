"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const memoChannels = {
  health: "memo:health",
  list: "memo:list",
  get: "memo:get",
  create: "memo:create",
  update: "memo:update",
  delete: "memo:delete",
  search: "memo:search",
  organize: "memo:organize",
  compose: "memo:compose"
};
const memoEventChannels = {
  changed: "memo:changed",
  organizeState: "memo:organize-state-changed"
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
  search(query) {
    return ipcRenderer.invoke(memoChannels.search, query);
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
