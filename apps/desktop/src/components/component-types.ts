import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";
import type { AiChatIntent } from "../domain/ai-chat";

export type AiChatInputHandler = Dispatch<SetStateAction<string>>;
export type AiChatModeHandler = Dispatch<SetStateAction<AiChatIntent>>;
export type MemoIdHandler = (memoId: MemoId) => void;
