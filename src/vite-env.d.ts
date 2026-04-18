/// <reference types="vite/client" />

type DesktopAPI = {
  platform: string;
  clipboard?: {
    writeText: (text: string) => void;
  };
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
