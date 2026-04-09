/// <reference types="vite/client" />

type DesktopAPI = {
  platform: string;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
};

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}

export {};
