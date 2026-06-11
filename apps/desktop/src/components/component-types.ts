import type { Dispatch, SetStateAction } from "react";
import type { MemoId } from "@ai-note/shared/memo";

export type AiChatInputHandler = Dispatch<SetStateAction<string>>;
export type MemoIdHandler = (memoId: MemoId) => void;
