type UseAppShellLayoutParams = {
  chatWidth: number;
  isAiChatOpen: boolean;
  isChatExpanded: boolean;
  isMacOS: boolean;
  isSidebarOpen: boolean;
  isStickyMode: boolean;
  sidebarWidth: number;
};

export function useAppShellLayout(params: UseAppShellLayoutParams) {
  return {
    appShellClassName: getAppShellClassName(params),
    appBodyClassName: getAppBodyClassName(params),
    appBodyGridStyle: getAppBodyGridStyle(params)
  };
}

function getAppShellClassName({ isMacOS, isStickyMode }: UseAppShellLayoutParams) {
  return ["app-shell", isMacOS ? "is-macos" : "", isStickyMode ? "is-sticky-mode" : ""].filter(Boolean).join(" ");
}

function getAppBodyClassName(params: UseAppShellLayoutParams) {
  return [
    "app-body",
    params.isSidebarOpen && !params.isStickyMode ? "" : "is-sidebar-hidden",
    params.isAiChatOpen && !params.isStickyMode ? "is-ai-chat-open" : "",
    params.isChatExpanded && params.isAiChatOpen && !params.isStickyMode ? "is-chat-expanded" : "",
    params.isStickyMode ? "is-sticky-mode" : ""
  ].filter(Boolean).join(" ");
}

function getAppBodyGridStyle(params: UseAppShellLayoutParams) {
  if (params.isStickyMode) return {};
  if (!params.isSidebarOpen && !params.isAiChatOpen) return { gridTemplateColumns: "1fr" };
  if (!params.isSidebarOpen) return getChatOnlyGridStyle(params);
  if (!params.isAiChatOpen) return { gridTemplateColumns: `${params.sidebarWidth}px 6px 1fr` };
  if (params.isChatExpanded) return { gridTemplateColumns: `${params.sidebarWidth}px 6px 1fr` };
  return { gridTemplateColumns: `${params.sidebarWidth}px 6px 1fr 6px ${params.chatWidth}px` };
}

function getChatOnlyGridStyle({ chatWidth, isChatExpanded }: UseAppShellLayoutParams) {
  return {
    gridTemplateColumns: isChatExpanded ? "1fr" : `1fr 6px ${chatWidth}px`
  };
}
