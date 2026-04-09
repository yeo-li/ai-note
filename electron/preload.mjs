import { contextBridge, ipcRenderer } from "electron";
import { memoChannels } from "./memo-channels.mjs";

const memoAPI = {
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
