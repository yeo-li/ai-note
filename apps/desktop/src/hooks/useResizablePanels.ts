import { useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type ResizeDrag = { startX: number; startWidth: number };
type PanelResizeSide = "left" | "right";
type PanelResizeConfig = {
  dragRef: MutableRefObject<ResizeDrag | null>;
  maxWidth: number;
  minWidth: number;
  setWidth: Dispatch<SetStateAction<number>>;
  side: PanelResizeSide;
};
type ResizablePanelsState = {
  chatResizeDragRef: MutableRefObject<ResizeDrag | null>;
  chatWidth: number;
  sidebarResizeDragRef: MutableRefObject<ResizeDrag | null>;
  sidebarWidth: number;
};

/**
 * 사이드바/채팅 패널 너비를 마우스 드래그로 조절하는 상태와 동작을 캡슐화한다.
 */
export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [chatWidth, setChatWidth] = useState(380);
  const sidebarResizeDragRef = useRef<ResizeDrag | null>(null);
  const chatResizeDragRef = useRef<ResizeDrag | null>(null);

  usePanelResizeListener({ dragRef: sidebarResizeDragRef, maxWidth: 480, minWidth: 200, setWidth: setSidebarWidth, side: "left" });
  usePanelResizeListener({ dragRef: chatResizeDragRef, maxWidth: 700, minWidth: 300, setWidth: setChatWidth, side: "right" });

  return createResizablePanelsResult({ chatResizeDragRef, chatWidth, sidebarResizeDragRef, sidebarWidth });
}

function usePanelResizeListener(config: PanelResizeConfig) {
  const { dragRef, maxWidth, minWidth, setWidth, side } = config;

  useEffect(() => addPanelResizeListeners(config), [dragRef, maxWidth, minWidth, setWidth, side]);
}

function createResizablePanelsResult(state: ResizablePanelsState) {
  return {
    sidebarWidth: state.sidebarWidth,
    chatWidth: state.chatWidth,
    startSidebarResize: (event: { clientX: number }) => startPanelResize(state.sidebarResizeDragRef, state.sidebarWidth, event.clientX),
    startChatResize: (event: { clientX: number }) => startPanelResize(state.chatResizeDragRef, state.chatWidth, event.clientX)
  };
}

function addPanelResizeListeners(config: PanelResizeConfig) {
  const onMouseMove = (event: MouseEvent) => applyPanelResize(config, event.clientX);
  const onMouseUp = () => finishPanelResize(config.dragRef);

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  return () => removePanelResizeListeners(onMouseMove, onMouseUp);
}

function removePanelResizeListeners(onMouseMove: (event: MouseEvent) => void, onMouseUp: () => void) {
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}

function applyPanelResize(config: PanelResizeConfig, clientX: number) {
  const drag = config.dragRef.current;
  if (!drag) return;

  const delta = getResizeDelta(config.side, drag.startX, clientX);
  config.setWidth(clampWidth(drag.startWidth + delta, config.minWidth, config.maxWidth));
}

function getResizeDelta(side: PanelResizeSide, startX: number, clientX: number) {
  return side === "left" ? clientX - startX : startX - clientX;
}

function clampWidth(width: number, minWidth: number, maxWidth: number) {
  return Math.min(Math.max(width, minWidth), maxWidth);
}

function startPanelResize(dragRef: MutableRefObject<ResizeDrag | null>, startWidth: number, startX: number) {
  dragRef.current = { startX, startWidth };
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}

function finishPanelResize(dragRef: MutableRefObject<ResizeDrag | null>) {
  if (!dragRef.current) return;
  dragRef.current = null;
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
}
