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
  organize: "memo:organize"
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
  create(input = {}) {
    return ipcRenderer.invoke(memoChannels.create, input);
  },
  update(id, patch = {}) {
    return ipcRenderer.invoke(memoChannels.update, id, patch);
  },
  delete(id) {
    return ipcRenderer.invoke(memoChannels.delete, id);
  },
  search(query) {
    return ipcRenderer.invoke(memoChannels.search, query);
  },
  organize(input) {
    return ipcRenderer.invoke(memoChannels.organize, input);
  }
};

contextBridge.exposeInMainWorld("desktopAPI", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

contextBridge.exposeInMainWorld("memoAPI", memoAPI);
