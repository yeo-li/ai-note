import { useEffect, useRef, useState } from "react";
import { closeQuickCaptureWindow } from "../infrastructure/desktop-window";

/**
 * 빠른 메모 창의 입력 상태와 저장/닫기 동작을 캡슐화한다.
 */
export function useQuickCaptureController() {
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  async function saveAndClose() {
    const trimmedBody = body.trim();

    if (!trimmedBody || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      await createQuickCaptureMemo(trimmedBody);
      await closeQuickCaptureWindow();
    } catch {
      setIsSaving(false);
    }
  }

  async function discardAndClose() {
    await closeQuickCaptureWindow();
  }

  return {
    body,
    isSaving,
    textareaRef,
    setBody,
    saveAndClose,
    discardAndClose
  };
}

async function createQuickCaptureMemo(body: string) {
  const create = window.memoAPI?.create;

  if (!create) {
    throw new Error("메모 저장소를 사용할 수 없어요.");
  }

  return create({ body });
}
