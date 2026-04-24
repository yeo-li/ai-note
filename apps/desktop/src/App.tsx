import { useEffect, useMemo, useRef, useState } from "react";
import type { Memo, MemoChangeEvent, MemoCreateInput, MemoId, MemoUpdateInput } from "@ai-note/shared/memo";
import type { MemoStoreHealth } from "./shared/memo-bridge";
import { buildMemoTitleFromBody, deriveNoteHeadline } from "./note-content";

type TransformMode = "default" | "organized";

type Note = {
  id: MemoId;
  body: string;
  favorite: boolean;
  updatedAt: string;
  dateLabel: string;
  mode: TransformMode;
};

type SidebarView = "all" | "favorites";

type NoteBackup = {
  body: string;
  mode: TransformMode;
};

type DeletedNoteState = {
  note: Note;
  index: number;
  backup: NoteBackup | null;
};

type TransformDraft = {
  noteId: MemoId;
  prompt: string;
  previewBody: string;
};

const initialNotes: Note[] = [
  {
    id: "note-1",
    updatedAt: "오후 5:16",
    dateLabel: "2026. 4. 1.",
    mode: "default",
    body:
      "TDD를 늦숙하게 리드해주셨습니다. 지금까지 진행했던 방식과 다른 TDD 방식으로 진행하시면서 제가 주로 따라가는 방향으로 흘러갔습니다. 저는 주로 클래스와 필요 메서드를 만들고 테스트를 작성했지만, 이번에는 순수하게 테스트를 먼저 짜는 방식으로 진행했습니다.\n\n처음에는 막막하고 어떤 생각이 들었지만 이 방식으로 진행하니 테스트를 하기 위해 메서드로 기능을 구현할 수 있었습니다. 제가 했던 방식은 메서드의 틀은 모두 정해져 있었기 때문에, 메서드에 테스트를 막 추가하고 테스트를 작성하지 못하는 경우도 있었습니다.\n\n하지만 리서의 TDD 방식을 사용하면 자연스럽게 테스트 친화적인 메서드를 작성할 수 있었고 결과적으로 TDD를 사용하지 않은 팀들보다도 더 일찍 구현을 마칠 수 있다는 것을 배워갈 수 있었습니다.\n\n구체적으로 사고하고 구현하는 능력이 남들보다 뛰어납니다. 스스로의 설계를 먼저 하기보다 구현을 먼저 해야한다고 말씀해주셨지만, 구현 능력이 좋기에 적은 설계로 금방 구현을 하실 수 있는 것 같습니다.\n\n저는 이러한 점을 보고 만약 제가 리서라면 개발 역량을 높이기 위해 조금씩 큰 설계하는 연습을 할 것 같습니다. 현재 리서는 나무를 보고 만드는 역량이 뛰어납니다. 여기에 숲을 보는 능력을 지금보다 더 성장시킨다면 남들보다 더 탁월할 수 있는 개발 능력을 갖출 수 있을 것 같습니다.\n\n1. 본인의 생각을 주관있게 잘 정리합니다. 적절한 팩트와 메서드와 관련된 이야기를 하면서 스스로의 생각에 근거가 명확하다는 것을 느꼈습니다.\n2. 협업할 줄 잘 아는 분입니다. 페어 프로그래밍을 하면서 가장 중요하게 서로를 오해하지 않는 것이라고 생각합니다.\n3. 공정적인 관찰력이 있습니다. 무엇을 먼저 해결해야 하는지 빠르게 구분하고 말로 풀어내는 점이 좋았습니다."
  },
  {
    id: "note-2",
    updatedAt: "오후 4:48",
    dateLabel: "이제",
    mode: "default",
    body:
      "오늘은 src/main/java 아래 구조를 조금 더 단순하게 정리했다.\n\n패키지별 책임이 겹치는 부분이 있어서 서비스 계층과 도메인 계층 사이 경계를 다시 나눴다. 구현을 빠르게 하기 위해 임시로 넣어둔 코드가 몇 군데 있었는데, 다음 단계에서는 테스트 가능성을 기준으로 다시 잘라내야 한다.\n\n특히 메서드 이름이 애매한 부분은 실제 비즈니스 흐름을 드러내는 이름으로 바꾸는 편이 낫다."
  },
  {
    id: "note-3",
    updatedAt: "오후 4:10",
    dateLabel: "이제",
    mode: "default",
    body:
      "로컬 초기화 스크립트를 정리하면서 실수로 운영용 쿼리와 헷갈리지 않도록 문구를 바꿨다.\n\n파괴적인 쿼리는 항상 별도 파일로 분리하고, 실행 전 확인 단계가 있도록 정리해두는 편이 안전하다."
  },
  {
    id: "note-4",
    updatedAt: "오후 3:32",
    dateLabel: "2026. 3. 31.",
    mode: "default",
    body:
      "좋은 설계는 추상적이어도 결국 구현을 안내해야 한다.\n\n말만 멋진 구조보다 실제 수정 지점이 줄어드는 구조가 낫다. 이번 스프린트에서는 메모 저장, 검색, AI 정리 흐름이 서로 덜 충돌하게 경계를 먼저 세우는 것이 중요하다."
  },
  {
    id: "note-5",
    updatedAt: "오후 1:12",
    dateLabel: "2026. 3. 31.",
    mode: "default",
    body:
      "문장을 많이 쓰는 것보다 결과가 잘 보이게 정리하는 것이 더 중요하다.\n\n한 줄 요약, 내가 맡은 범위, 개선 전후 차이, 검증 방법이 보이게 쓰면 전달력이 좋아진다."
  },
  {
    id: "note-6",
    updatedAt: "오전 11:03",
    dateLabel: "2026. 3. 27.",
    mode: "default",
    body:
      "협업 규칙은 길게 적는 것보다 자주 부딪히는 문제를 막는 정도가 적당하다.\n\n브랜치 책임 범위, PR 설명, 검증 기준, 공통 인터페이스 변경 순서 정도만 명확해도 병렬 작업이 훨씬 안정적이다."
  },
  {
    id: "note-7",
    updatedAt: "오전 9:54",
    dateLabel: "2026. 3. 9.",
    mode: "default",
    body:
      "값 객체는 데이터 구조가 아니라 규칙을 품고 있어야 한다.\n\n단순히 필드를 묶는 데 그치지 말고, 유효성 보장과 의미 있는 비교 기준을 함께 가져가야 한다."
  },
  {
    id: "note-8",
    updatedAt: "오전 9:20",
    dateLabel: "2026. 2. 27.",
    mode: "default",
    body:
      "짧은 피드백 하나가 작업 속도를 크게 바꾸는 순간이 있었다.\n\n문제를 크게 설명하기보다 지금 막히는 지점을 정확히 짚어주는 피드백이 가장 강력했다."
  }
].map((note): Note => ({
  ...note,
  mode: note.mode as TransformMode,
  favorite: false
}));

function matchesQuery(note: Note, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [note.body, note.dateLabel, note.updatedAt]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function nowStamp() {
  const now = new Date();

  return {
    updatedAt: now.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit"
    }),
    dateLabel: `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`
  };
}

function createNote(): Note {
  return {
    id: `note-${Date.now()}`,
    body: "",
    favorite: false,
    mode: "default",
    ...nowStamp()
  };
}

function formatDateLabelFromIso(iso: string) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return nowStamp().dateLabel;
  }

  return `${parsed.getFullYear()}. ${parsed.getMonth() + 1}. ${parsed.getDate()}.`;
}

function formatUpdatedAtFromIso(iso: string) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return nowStamp().updatedAt;
  }

  return parsed.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function toNoteFromMemo(memo: Memo, mode: TransformMode = "default"): Note {
  return {
    id: memo.id,
    body: memo.body,
    favorite: memo.favorite ?? false,
    updatedAt: formatUpdatedAtFromIso(memo.updatedAt),
    dateLabel: formatDateLabelFromIso(memo.updatedAt),
    mode
  };
}

function upsertSyncedNote(currentNotes: Note[], memo: Memo) {
  const incomingNote = toNoteFromMemo(memo);
  const existingNote = currentNotes.find((note) => note.id === incomingNote.id);
  const mergedNote = existingNote
      ? {
          ...existingNote,
          body: incomingNote.body,
          favorite: incomingNote.favorite,
          updatedAt: incomingNote.updatedAt,
          dateLabel: incomingNote.dateLabel
        }
    : incomingNote;

  return [mergedNote, ...currentNotes.filter((note) => note.id !== mergedNote.id)];
}

function removeSyncedNote(currentNotes: Note[], memoId: MemoId) {
  return currentNotes.filter((note) => note.id !== memoId);
}

const storageKindLabels: Record<MemoStoreHealth["storeKind"], string> = {
  sqlite: "SQLite",
  json: "JSON",
  memory: "Memory"
};

function getStorageKindLabel(kind: MemoStoreHealth["storeKind"]) {
  return storageKindLabels[kind] ?? "Memory";
}

function getStorageStatusSummary(health: MemoStoreHealth | null) {
  if (!health) {
    return "";
  }

  if (!health.ready) {
  return "저장소 연결을 확인하지 못해서 지금은 편집을 잠가두었어요.";
  }

  if (health.fallbackReason) {
  return `SQLite 초기화에 실패해서 ${getStorageKindLabel(health.storeKind)} 저장소로 전환했어요.`;
  }

  return "";
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "알 수 없는 저장소 오류";
}

function toMemoUpdateInput(update: Partial<Note>): MemoUpdateInput {
  const patch: MemoUpdateInput = {};

  if (typeof update.body === "string") {
    patch.body = update.body;
    // 저장소/검색 계층과의 호환성을 위해 title은 본문 첫 줄에서 파생한다.
    patch.title = buildMemoTitleFromBody(update.body);
  }

  if (typeof update.favorite === "boolean") {
    patch.favorite = update.favorite;
  }

  return patch;
}

function normalizeParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s{2,}/g, " ")
    )
    .filter(Boolean);
}

function organizeNoteBody(text: string) {
  const paragraphs = normalizeParagraphs(text);

  if (paragraphs.length === 0) {
    return text;
  }

  return paragraphs
    .map((paragraph) => {
      if (/^\d+\./.test(paragraph)) {
        return paragraph;
      }

      return paragraph.replace(/\s*-\s*/g, ", ");
    })
    .join("\n\n");
}

function convertToPoliteBody(text: string) {
  const paragraphs = normalizeParagraphs(text);

  if (paragraphs.length === 0) {
    return text;
  }

  return paragraphs
    .map((paragraph) => {
      let converted = paragraph
        .replace(/한다\./g, "합니다.")
        .replace(/했다\./g, "했습니다.")
        .replace(/있다\./g, "있습니다.")
        .replace(/없다\./g, "없습니다.")
        .replace(/좋다\./g, "좋습니다.")
        .replace(/된다\./g, "됩니다.")
        .replace(/바꿨다\./g, "바꿨습니다.")
        .replace(/정리했다\./g, "정리했습니다.")
        .replace(/느꼈다\./g, "느꼈습니다.")
        .replace(/필요하다\./g, "필요합니다.");

      if (!/[.!?]$/.test(converted)) {
        converted = `${converted} 입니다.`;
      }

      return converted;
    })
    .join("\n\n");
}

function summarizeNoteBody(text: string) {
  const paragraphs = normalizeParagraphs(text);

  if (paragraphs.length === 0) {
    return text;
  }

  return paragraphs
    .slice(0, 3)
    .map((paragraph) => {
      const [firstSentence] = paragraph.split(/(?<=[.!?])\s+/);
      const compact = (firstSentence ?? paragraph).trim();

      if (compact.length <= 88) {
        return compact;
      }

      return `${compact.slice(0, 88).trim()}...`;
    })
    .join("\n");
}

function listifyNoteBody(text: string) {
  const paragraphs = normalizeParagraphs(text);

  if (paragraphs.length === 0) {
    return text;
  }

  return paragraphs
    .map((paragraph) => {
      if (/^[-*]\s/.test(paragraph) || /^\d+\./.test(paragraph)) {
        return paragraph;
      }

      return `- ${paragraph}`;
    })
    .join("\n");
}

function buildAiOrganizedBody(text: string, prompt: string) {
  const normalizedPrompt = prompt.trim().toLowerCase();
  let previewBody = organizeNoteBody(text);

  if (!normalizedPrompt) {
    return previewBody;
  }

  if (/(요약|짧게|간단|핵심|summary)/.test(normalizedPrompt)) {
    previewBody = summarizeNoteBody(previewBody);
  }

  if (/(목록|불릿|bullet|항목|리스트)/.test(normalizedPrompt)) {
    previewBody = listifyNoteBody(previewBody);
  }

  if (/(공손|존댓말|격식|정중|polite)/.test(normalizedPrompt)) {
    previewBody = convertToPoliteBody(previewBody);
  }

  return previewBody;
}

type LaunchContext = {
  stickyMode: boolean;
  requestedNoteId: MemoId | null;
};

function readLaunchContext(): LaunchContext {
  if (typeof window === "undefined") {
    return {
      stickyMode: false,
      requestedNoteId: null
    };
  }

  const query = new URLSearchParams(window.location.search);
  const requestedNoteId = query.get("noteId");

  return {
    stickyMode: query.get("view") === "sticky",
    requestedNoteId: requestedNoteId && requestedNoteId.trim().length > 0 ? requestedNoteId.trim() : null
  };
}

function StickyCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function StickyPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M8 3h8l-1.5 5 3.5 4v1H6v-1l3.5-4z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SidebarListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function SidebarFavoriteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3.8 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8z" />
    </svg>
  );
}

function ToolbarStickyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="m10 14 10-10" />
      <path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

function ToolbarSidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </svg>
  );
}

function ToolbarSparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 13.8 8 18.5 9.8 13.8 11.6 12 16.1 10.2 11.6 5.5 9.8 10.2 8z" />
      <path d="M18.5 15.5 19.3 17.4 21.2 18.2 19.3 19 18.5 20.9 17.7 19 15.8 18.2 17.7 17.4z" />
    </svg>
  );
}

function ToolbarUndoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7H4v5" />
      <path d="M4.6 11.5A8 8 0 1 1 8 18" />
    </svg>
  );
}

function NoteFavoriteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3.8 2.5 5 5.5.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.5-.8z" />
    </svg>
  );
}

function ToolbarFindIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function NoteMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5h.01" />
      <path d="M12 12h.01" />
      <path d="M12 19h.01" />
    </svg>
  );
}

type FindMatch = {
  start: number;
  end: number;
};

function findMatchesInBody(body: string, query: string): FindMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const normalizedBody = body.toLocaleLowerCase();
  const matches: FindMatch[] = [];
  let searchIndex = 0;

  while (searchIndex < normalizedBody.length) {
    const matchIndex = normalizedBody.indexOf(normalizedQuery, searchIndex);

    if (matchIndex === -1) {
      break;
    }

    matches.push({
      start: matchIndex,
      end: matchIndex + normalizedQuery.length
    });
    searchIndex = matchIndex + normalizedQuery.length;
  }

  return matches;
}

function App() {
  const launchContext = useMemo(() => readLaunchContext(), []);
  const isDedicatedStickyWindow = launchContext.stickyMode;
  const isMacOS =
    window.desktopAPI?.platform === "darwin" ||
    (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<MemoId | "">(initialNotes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [sidebarView, setSidebarView] = useState<SidebarView>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!launchContext.stickyMode);
  const [isStickyMode, setIsStickyMode] = useState(launchContext.stickyMode);
  const [isStickyPinned, setIsStickyPinned] = useState(false);
  const [statusMessage, setStatusMessage] = useState("저장소 연결 상태를 확인하고 있어요.");
  const [storageHealth, setStorageHealth] = useState<MemoStoreHealth | null>(null);
  const [isStorageLocked, setIsStorageLocked] = useState(true);
  const [backups, setBackups] = useState<Record<MemoId, NoteBackup>>({});
  const [deleteIntentId, setDeleteIntentId] = useState<MemoId | null>(null);
  const [noteMenuId, setNoteMenuId] = useState<MemoId | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedNoteState | null>(null);
  const [draftTransform, setDraftTransform] = useState<TransformDraft | null>(null);
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isFindBarOpen, setIsFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [isPreviewActionCoolingDown, setIsPreviewActionCoolingDown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const aiPromptInputRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const noteBodyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const previewActionCooldownRef = useRef<number | null>(null);
  const emptyCreateButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyFirstResultButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyClearSearchButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasQuery = query.trim().length > 0;
  const scopedNotes = useMemo(
    () => notes.filter((note) => (sidebarView === "favorites" ? note.favorite : true)),
    [notes, sidebarView]
  );
  const filteredNotes = useMemo(
    () => scopedNotes.filter((note) => matchesQuery(note, query)),
    [scopedNotes, query]
  );
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function hydrateNotes() {
      if (!window.memoAPI) {
        if (cancelled) {
          return;
        }

        setStorageHealth({
          bridgeConnected: false,
          ready: false,
          storeKind: "memory",
          errorMessage: "memoAPI 브리지를 찾지 못했어요."
        });
        setIsStorageLocked(true);
        setNotes([]);
        setSelectedNoteId("");
        setStatusMessage("메모 저장소 브리지가 연결되지 않아서 편집을 잠가두었어요.");
        return;
      }

      try {
        const health =
          typeof window.memoAPI.health === "function"
            ? await window.memoAPI.health()
            : {
                bridgeConnected: true,
                ready: false,
                storeKind: "memory" as const,
                errorMessage: "memoAPI.health 핸들러를 찾지 못했어요."
              };

        if (cancelled) {
          return;
        }

        setStorageHealth(health);

        if (!health.ready) {
          setIsStorageLocked(true);
          setNotes([]);
          setSelectedNoteId("");
          setStatusMessage(`저장소 연결에 실패했어요: ${health.errorMessage ?? "원인을 확인할 수 없어요."}`);
          return;
        }

        const existingMemos = await window.memoAPI.list();

        if (cancelled) {
          return;
        }

        setIsStorageLocked(false);

        const storageLabel = getStorageKindLabel(health.storeKind);

        if (existingMemos.length > 0) {
          const loadedNotes = existingMemos.map((memo) => toNoteFromMemo(memo));
          const preferredSelectedNote =
            launchContext.requestedNoteId && loadedNotes.some((note) => note.id === launchContext.requestedNoteId)
              ? launchContext.requestedNoteId
              : loadedNotes[0]?.id ?? "";
          setNotes(loadedNotes);
          setSelectedNoteId(preferredSelectedNote);
          setStatusMessage(
            health.fallbackReason
              ? `SQLite 초기화에 실패해서 ${storageLabel} 저장소를 사용하고 있어요.`
              : `${storageLabel} 저장소를 불러왔어요.`
          );
          return;
        }

        const seededNotes: Note[] = [];

        for (const seedNote of [...initialNotes].reverse()) {
          const createdMemo = await window.memoAPI.create({
            title: buildMemoTitleFromBody(seedNote.body),
            body: seedNote.body
          });

          if (cancelled) {
            return;
          }

          seededNotes.unshift(toNoteFromMemo(createdMemo, seedNote.mode));
        }

        setNotes(seededNotes);
        const preferredSeededNote =
          launchContext.requestedNoteId && seededNotes.some((note) => note.id === launchContext.requestedNoteId)
            ? launchContext.requestedNoteId
            : seededNotes[0]?.id ?? "";
        setSelectedNoteId(preferredSeededNote);
        setStatusMessage(
          health.fallbackReason
            ? `SQLite 초기화에 실패해서 ${storageLabel} 저장소를 초기화했어요.`
            : `${storageLabel} 저장소를 초기화했어요.`
        );
      } catch (error) {
        if (!cancelled) {
          const message = toErrorMessage(error);
          setStorageHealth({
            bridgeConnected: true,
            ready: false,
            storeKind: "memory",
            errorMessage: message
          });
          setIsStorageLocked(true);
          setNotes([]);
          setSelectedNoteId("");
          setStatusMessage(`저장소 연결이 중단되어서 편집을 잠가두었어요: ${message}`);
        }
      }
    }

    void hydrateNotes();

    return () => {
      cancelled = true;
    };
  }, [launchContext.requestedNoteId]);

  useEffect(() => {
    if (!window.memoAPI?.onDidChange) {
      return;
    }

    const unsubscribe = window.memoAPI.onDidChange((changeEvent: MemoChangeEvent) => {
      if (changeEvent.type === "deleted") {
        const { memoId } = changeEvent;

        setNotes((currentNotes) => removeSyncedNote(currentNotes, memoId));
        setDeleteIntentId((currentDeleteIntentId) => (currentDeleteIntentId === memoId ? null : currentDeleteIntentId));
        setNoteMenuId((currentNoteMenuId) => (currentNoteMenuId === memoId ? null : currentNoteMenuId));
        setRecentlyDeleted((currentDeletedState) => (currentDeletedState?.note.id === memoId ? null : currentDeletedState));
        setDraftTransform((currentDraft) => (currentDraft?.noteId === memoId ? null : currentDraft));
        setBackups((currentBackups) => {
          if (!currentBackups[memoId]) {
            return currentBackups;
          }

          const nextBackups = { ...currentBackups };
          delete nextBackups[memoId];
          return nextBackups;
        });

        return;
      }

      setNotes((currentNotes) => upsertSyncedNote(currentNotes, changeEvent.memo));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (notes.length === 0) {
      if (selectedNoteId) {
        setSelectedNoteId("");
      }
      return;
    }

    if (sidebarView === "favorites") {
      if (scopedNotes.length === 0) {
        return;
      }

      if (scopedNotes.some((note) => note.id === selectedNoteId)) {
        return;
      }

      setSelectedNoteId(scopedNotes[0].id);
      return;
    }

    if (selectedNote) {
      return;
    }

    if (selectedNoteId !== notes[0].id) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, scopedNotes, selectedNote, selectedNoteId, sidebarView]);

  const activeNote = useMemo(() => {
    if (notes.length === 0) {
      return null;
    }

    if (sidebarView === "favorites") {
      if (scopedNotes.length === 0) {
        return null;
      }

      return scopedNotes.find((note) => note.id === selectedNoteId) ?? null;
    }

    return selectedNote ?? notes[0];
  }, [notes, scopedNotes, selectedNote, selectedNoteId, sidebarView]);
  const findMatches = useMemo(() => findMatchesInBody(activeNote?.body ?? "", findQuery), [activeNote?.body, findQuery]);

  const isCollectionEmpty = notes.length === 0;
  const isSidebarViewEmpty = scopedNotes.length === 0;
  const isSelectionOutsideCurrentSidebarScope =
    sidebarView === "favorites" && Boolean(selectedNote) && !scopedNotes.some((note) => note.id === selectedNoteId);
  const hasBackup = activeNote ? Boolean(backups[activeNote.id]) : false;
  const activeDraft =
    draftTransform && activeNote && draftTransform.noteId === activeNote.id ? draftTransform : null;
  const noteCountLabel = isSidebarViewEmpty
    ? sidebarView === "favorites"
      ? "즐겨찾기가 없다"
      : "메모가 없다"
    : hasQuery
      ? `${filteredNotes.length}개의 검색 결과`
      : sidebarView === "favorites"
        ? `${scopedNotes.length}개의 즐겨찾기`
        : `${notes.length}개의 메모`;
  const deleteTargetNote = deleteIntentId ? notes.find((note) => note.id === deleteIntentId) ?? null : null;
  const deleteTargetHeadline = deleteTargetNote ? deriveNoteHeadline(deleteTargetNote.body) : "";
  const isDeleteModalOpen = Boolean(deleteTargetNote);
  const isMutationLocked = isStorageLocked || !storageHealth?.ready;
  const storageKindLabel = storageHealth ? getStorageKindLabel(storageHealth.storeKind) : "확인 중";
  const storageBadgeLabel = storageHealth
    ? `저장소 ${storageKindLabel}`
    : "저장소 확인 중";
  const storageStatusSummary = getStorageStatusSummary(storageHealth);
  const storageBadgeClassName = [
    "storage-status-badge",
    storageHealth ? `is-${storageHealth.storeKind}` : "is-loading",
    storageHealth?.ready ? "" : "is-error"
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setDraftTransform((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      if (!activeNote || currentDraft.noteId !== activeNote.id) {
        return null;
      }

      return currentDraft;
    });
  }, [activeNote]);

  useEffect(() => {
    setIsAiPromptOpen(false);
    setAiPrompt("");
  }, [activeNote?.id]);

  useEffect(() => {
    if (!isAiPromptOpen) {
      return;
    }

    aiPromptInputRef.current?.focus();
    aiPromptInputRef.current?.select();
  }, [isAiPromptOpen]);

  useEffect(() => {
    if (!isFindBarOpen) {
      return;
    }

    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [isFindBarOpen]);

  useEffect(() => {
    setIsFindBarOpen(false);
    setFindQuery("");
    setFindMatchIndex(0);
  }, [activeNote?.id, isStickyMode]);

  useEffect(() => {
    if (!isFindBarOpen) {
      return;
    }

    if (findMatches.length === 0) {
      setFindMatchIndex(0);
      return;
    }

    if (findMatchIndex >= findMatches.length) {
      setFindMatchIndex(0);
    }
  }, [findMatchIndex, findMatches, isFindBarOpen]);

  useEffect(() => {
    if (!isFindBarOpen || !activeNote || findMatches.length === 0) {
      return;
    }

    const target = findMatches[findMatchIndex] ?? findMatches[0];

    if (!target || !noteBodyInputRef.current) {
      return;
    }

    noteBodyInputRef.current.focus();
    noteBodyInputRef.current.setSelectionRange(target.start, target.end);
  }, [activeNote, findMatchIndex, findMatches, isFindBarOpen]);

  useEffect(() => {
    if (activeNote || typeof document === "undefined") {
      return;
    }

    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }

    const nextTarget =
      emptyFirstResultButtonRef.current ??
      emptyClearSearchButtonRef.current ??
      emptyCreateButtonRef.current ??
      searchInputRef.current;

    nextTarget?.focus();
  }, [activeNote, isSelectionOutsideCurrentSidebarScope]);

  useEffect(() => {
    return () => {
      if (previewActionCooldownRef.current !== null) {
        window.clearTimeout(previewActionCooldownRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDeleteModalOpen || typeof window === "undefined") {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelDeleteNote();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [isDeleteModalOpen]);

  useEffect(() => {
    if (!noteMenuId) {
      return;
    }

    if (
      ((hasQuery || sidebarView === "favorites") && !filteredNotes.some((note) => note.id === noteMenuId)) ||
      !notes.some((note) => note.id === noteMenuId)
    ) {
      setNoteMenuId(null);
    }
  }, [filteredNotes, hasQuery, noteMenuId, notes, sidebarView]);

  useEffect(() => {
    if (!noteMenuId || typeof window === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const nextTarget = event.target;

      if (!(nextTarget instanceof Element)) {
        setNoteMenuId(null);
        return;
      }

      if (nextTarget.closest("[data-note-menu-root='true']")) {
        return;
      }

      setNoteMenuId(null);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNoteMenuId(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [noteMenuId]);

  useEffect(() => {
    if (!isStickyMode) {
      setIsStickyPinned(false);
      return;
    }

    setIsSidebarOpen(false);
    setDeleteIntentId(null);
    setNoteMenuId(null);
    setDraftTransform(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");
  }, [isStickyMode]);

  function patchActiveNote(update: Partial<Note>, message?: string) {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 편집이 잠겨 있어요.");
      return;
    }

    if (!activeNote) {
      return;
    }

    const activeNoteId = activeNote.id;
    const shouldRefreshTimestamp = typeof update.body === "string";
    const stamp = shouldRefreshTimestamp ? nowStamp() : null;

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === activeNoteId
          ? {
              ...note,
              ...update,
              updatedAt: stamp?.updatedAt ?? note.updatedAt,
              dateLabel: update.dateLabel ?? stamp?.dateLabel ?? note.dateLabel
            }
          : note
      )
    );

    setDeleteIntentId(null);
    setNoteMenuId(null);
    setDraftTransform(null);

    const persistencePatch = toMemoUpdateInput(update);

    if (window.memoAPI && Object.keys(persistencePatch).length > 0) {
      void window.memoAPI
        .update(activeNoteId, persistencePatch)
        .then(() => {
          // 입력 중 텍스트를 IPC 응답값으로 다시 덮어쓰면
          // IME 조합 입력(한글)에서 중복 입력처럼 보일 수 있어 로컬 상태를 유지한다.
        })
        .catch(() => {
          setStatusMessage("메모 변경을 저장소에 반영하지 못했어요.");
        });
    }

    if (message) {
      setStatusMessage(message);
    }
  }

  function switchSidebarView(nextView: SidebarView) {
    setSidebarView(nextView);
    setDeleteIntentId(null);
    setNoteMenuId(null);

    if (nextView === "favorites") {
      setStatusMessage("즐겨찾기 메모만 보고 있어요.");
      return;
    }

    setStatusMessage(hasQuery ? "현재 검색어 기준으로 전체 메모를 다시 보고 있어요." : "전체 메모를 보고 있어요.");
  }

  function toggleFavorite(noteId: MemoId) {
    const targetNote = notes.find((note) => note.id === noteId);

    if (!targetNote) {
      return;
    }

    const nextFavorite = !targetNote.favorite;

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              favorite: nextFavorite
            }
          : note
      )
    );
    setNoteMenuId(null);
    setStatusMessage(nextFavorite ? "즐겨찾기에 추가했어요." : "즐겨찾기에서 뺐어요.");

    if (window.memoAPI) {
      void window.memoAPI.update(noteId, { favorite: nextFavorite }).catch(() => {
        setStatusMessage("즐겨찾기 상태를 저장소에 반영하지 못했어요.");
      });
    }
  }

  function openFindBar() {
    if (!activeNote || isStickyMode) {
      setStatusMessage("지금은 메모 본문 찾기를 열 수 없어요.");
      return;
    }

    setIsFindBarOpen(true);
    setStatusMessage("메모 안에서 찾기를 열었어요.");
  }

  function closeFindBar() {
    setIsFindBarOpen(false);
    setFindQuery("");
    setFindMatchIndex(0);
    noteBodyInputRef.current?.focus();
    setStatusMessage("메모 안에서 찾기를 닫았어요.");
  }

  function moveFindMatch(direction: 1 | -1) {
    if (findMatches.length === 0) {
      setStatusMessage(`"${findQuery.trim()}"을 찾지 못했어요.`);
      return;
    }

    setFindMatchIndex((currentIndex) => {
      const nextIndex = (currentIndex + direction + findMatches.length) % findMatches.length;
      return nextIndex;
    });
    setStatusMessage(`"${findQuery.trim()}" 검색 결과 ${findMatches.length}개 중에서 이동하고 있어요.`);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";

      if (!isFindShortcut) {
        return;
      }

      event.preventDefault();
      openFindBar();
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [activeNote, isStickyMode]);

  async function handleCreateNote() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 새 메모를 만들 수 없어요.");
      return;
    }

    let nextNote = createNote();

    if (window.memoAPI) {
      try {
        const createInput: MemoCreateInput = {
          title: buildMemoTitleFromBody(nextNote.body),
          body: nextNote.body
        };
        const createdMemo = await window.memoAPI.create(createInput);

        nextNote = toNoteFromMemo(createdMemo);
      } catch {
        setStatusMessage("새 메모를 만들지 못했어요.");
        return;
      }
    }

    setNotes((currentNotes) => [nextNote, ...currentNotes.filter((note) => note.id !== nextNote.id)]);
    setSelectedNoteId(nextNote.id);
    setQuery("");
    setDeleteIntentId(null);
    setNoteMenuId(null);
    setRecentlyDeleted(null);
    setDraftTransform(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setStatusMessage("새 메모를 만들고 바로 편집할 수 있게 열어두었어요.");
  }

  async function handleCreateStickyNoteWindow() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 새 스티커 메모를 만들 수 없어요.");
      return;
    }

    const openStickyNote = window.desktopAPI?.window?.openStickyNote;

    if (!openStickyNote) {
      setStatusMessage("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있어요.");
      return;
    }

    let nextNote = createNote();

    if (window.memoAPI) {
      try {
        const createInput: MemoCreateInput = {
          title: buildMemoTitleFromBody(nextNote.body),
          body: nextNote.body
        };
        const createdMemo = await window.memoAPI.create(createInput);

        nextNote = toNoteFromMemo(createdMemo);
      } catch {
        setStatusMessage("새 스티커 메모를 만들지 못했어요.");
        return;
      }
    }

    setNotes((currentNotes) => [nextNote, ...currentNotes.filter((note) => note.id !== nextNote.id)]);

    try {
      await openStickyNote(nextNote.id);
      setStatusMessage("새 스티커 메모를 추가했어요.");
    } catch {
      setStatusMessage("새 스티커 메모 창을 열지 못했어요.");
    }
  }

  function handleSearch(nextQuery: string) {
    const trimmedQuery = nextQuery.trim();
    const matchingNotes = scopedNotes.filter((note) => matchesQuery(note, nextQuery));

    setQuery(nextQuery);
    setDeleteIntentId(null);
    setNoteMenuId(null);
    setDraftTransform(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");

    if (!trimmedQuery) {
      if (selectedNote) {
        setSelectedNoteId(selectedNote.id);
      }

      setStatusMessage(sidebarView === "favorites" ? "즐겨찾기 목록을 다시 보고 있어요." : "전체 메모를 다시 보고 있어요.");
      return;
    }

    if (selectedNote && matchesQuery(selectedNote, nextQuery)) {
      setStatusMessage(`"${trimmedQuery}" 검색 결과 ${matchingNotes.length}개 안에서도 현재 메모를 그대로 보고 있어요.`);
      return;
    }

    if (matchingNotes.length > 0) {
      setStatusMessage(`"${trimmedQuery}" 검색 결과가 ${matchingNotes.length}개 있어요. 목록에서 메모를 골라주세요.`);
      return;
    }

    setStatusMessage(`"${trimmedQuery}"에 맞는 메모를 찾지 못했어요.`);
  }

  function rememberOriginalIfNeeded() {
    if (!activeNote) {
      return;
    }

    setBackups((currentBackups) =>
      currentBackups[activeNote.id]
        ? currentBackups
        : {
            ...currentBackups,
            [activeNote.id]: {
              body: activeNote.body,
              mode: activeNote.mode
            }
          }
    );
  }

  function openAiPromptComposer() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없어요.");
      return;
    }

    if (isStickyMode) {
      setStatusMessage("스티커 메모에서는 AI 정리 미리보기를 열 수 없어요. 일반 모드에서 실행해 주세요.");
      return;
    }

    if (!activeNote) {
      return;
    }

    setDeleteIntentId(null);
    setNoteMenuId(null);
    setAiPrompt((currentPrompt) => currentPrompt || activeDraft?.prompt || "");
    setIsAiPromptOpen(true);
    setStatusMessage("AI 정리 입력창을 열어두었어요.");
  }

  function closeAiPromptComposer() {
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setStatusMessage("AI 정리 입력창을 닫았어요.");
  }

  function startTransformPreview() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없어요.");
      return;
    }

    if (isStickyMode) {
      setStatusMessage("스티커 메모에서는 AI 정리 미리보기를 열 수 없어요. 일반 모드에서 실행해 주세요.");
      return;
    }

    if (!activeNote) {
      return;
    }

    if (!activeNote.body.trim()) {
      setStatusMessage("본문이 비어 있어서 정리할 내용이 없어요.");
      return;
    }

    const trimmedPrompt = aiPrompt.trim();
    const previewBody = buildAiOrganizedBody(activeNote.body, trimmedPrompt);

    setDeleteIntentId(null);
    setNoteMenuId(null);
    setDraftTransform({
      noteId: activeNote.id,
      prompt: trimmedPrompt,
      previewBody
    });
    setIsPreviewActionCoolingDown(false);
    setIsAiPromptOpen(true);
    setStatusMessage(trimmedPrompt ? "AI 정리 미리보기를 만들었어요." : "기본 AI 정리 미리보기를 만들었어요.");
  }

  function cancelTransformPreview() {
    setNoteMenuId(null);
    setDraftTransform(null);
    setIsPreviewActionCoolingDown(true);
    if (previewActionCooldownRef.current !== null) {
      window.clearTimeout(previewActionCooldownRef.current);
    }
    previewActionCooldownRef.current = window.setTimeout(() => {
      setIsPreviewActionCoolingDown(false);
      previewActionCooldownRef.current = null;
    }, 220);
    setStatusMessage("미리보기를 닫았어요.");
  }

  function applyTransformDraft() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 미리보기를 적용할 수 없어요.");
      return;
    }

    if (!activeNote || !activeDraft) {
      return;
    }

    rememberOriginalIfNeeded();

    patchActiveNote(
      {
        body: activeDraft.previewBody,
        mode: "organized"
      },
      activeDraft.prompt ? "AI 정리 결과를 현재 메모에 반영했어요." : "기본 AI 정리 결과를 반영했어요."
    );
  }

  function restoreOriginal() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 원문 복원을 실행할 수 없어요.");
      return;
    }

    if (!activeNote || !backups[activeNote.id]) {
      setStatusMessage("복원할 원문이 없어요.");
      return;
    }

    const original = backups[activeNote.id];

    patchActiveNote(
      {
        body: original.body,
        mode: original.mode
      },
      "원문 상태로 다시 복원했어요."
    );

    setIsAiPromptOpen(false);
    setAiPrompt("");
    setDraftTransform(null);
    setNoteMenuId(null);
    setBackups((currentBackups) => {
      const nextBackups = { ...currentBackups };
      delete nextBackups[activeNote.id];
      return nextBackups;
    });
  }

  function beginDeleteNote(noteId?: MemoId) {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 삭제할 수 없어요.");
      return;
    }

    const targetNote = noteId
      ? notes.find((note) => note.id === noteId) ?? null
      : activeNote;

    if (noteId && !targetNote) {
      setNoteMenuId(null);
      setStatusMessage("삭제할 메모를 찾지 못했어요.");
      return;
    }

    if (!targetNote) {
      return;
    }

    setDraftTransform(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setNoteMenuId(null);
    setDeleteIntentId(targetNote.id);
    setStatusMessage(`"${deriveNoteHeadline(targetNote.body)}" 메모를 삭제할까요?`);
  }

  function cancelDeleteNote() {
    setDeleteIntentId(null);
    setStatusMessage("삭제를 취소했어요.");
  }

  function toggleNoteMenu(noteId: MemoId) {
    setDeleteIntentId(null);
    setNoteMenuId((currentNoteMenuId) => (currentNoteMenuId === noteId ? null : noteId));
  }

  function confirmDeleteNote() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 삭제할 수 없어요.");
      return;
    }

    if (!deleteTargetNote) {
      setDeleteIntentId(null);
      return;
    }

    const deletedNoteId = deleteTargetNote.id;
    const deletedBackup = backups[deleteTargetNote.id] ?? null;
    const currentVisibleNotes = hasQuery ? filteredNotes : sidebarView === "favorites" ? scopedNotes : notes;
    const deletedIndex = notes.findIndex((note) => note.id === deleteTargetNote.id);
    const deletedVisibleIndex = currentVisibleNotes.findIndex((note) => note.id === deleteTargetNote.id);
    const shouldKeepSelection = selectedNoteId.length > 0 && selectedNoteId !== deleteTargetNote.id;

    if (deletedIndex < 0) {
      setDeleteIntentId(null);
      return;
    }

    const nextNotes = notes.filter((note) => note.id !== deleteTargetNote.id);
    const scopedNextNotes = nextNotes.filter((note) => (sidebarView === "favorites" ? note.favorite : true));
    const visibleNotes = hasQuery ? scopedNextNotes.filter((note) => matchesQuery(note, query)) : scopedNextNotes;
    const fallbackSelected =
      visibleNotes[Math.min(Math.max(deletedVisibleIndex, 0), Math.max(visibleNotes.length - 1, 0))] ??
      nextNotes[Math.min(deletedIndex, Math.max(nextNotes.length - 1, 0))] ??
      null;
    const nextSelected =
      shouldKeepSelection && nextNotes.some((note) => note.id === selectedNoteId)
        ? nextNotes.find((note) => note.id === selectedNoteId) ?? fallbackSelected
        : fallbackSelected;

    setNotes(nextNotes);
    setSelectedNoteId(nextSelected?.id ?? "");
    setDeleteIntentId(null);
    setNoteMenuId(null);
    setDraftTransform(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setRecentlyDeleted({
      note: deleteTargetNote,
      index: deletedIndex,
      backup: deletedBackup
    });
    setBackups((currentBackups) => {
      const nextBackups = { ...currentBackups };
      delete nextBackups[deleteTargetNote.id];
      return nextBackups;
    });
      setStatusMessage("메모를 삭제했어요. 바로 되돌릴 수 있어요.");

    if (window.memoAPI) {
      void window.memoAPI.delete(deletedNoteId).catch(() => {
      setStatusMessage("메모 삭제를 저장소에 반영하지 못했어요.");
      });
    }
  }

  async function undoDelete() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 되돌리기를 실행할 수 없어요.");
      return;
    }

    if (!recentlyDeleted) {
      return;
    }

    const deletedSnapshot = recentlyDeleted;
    let restoredNote = deletedSnapshot.note;

    if (window.memoAPI) {
      try {
        const recreatedMemo = await window.memoAPI.create({
          title: buildMemoTitleFromBody(deletedSnapshot.note.body),
          body: deletedSnapshot.note.body
        });

        restoredNote = toNoteFromMemo(recreatedMemo, deletedSnapshot.note.mode);
      } catch {
      setStatusMessage("삭제 복원을 저장소에 반영하지 못했어요.");
      }
    }

    setNotes((currentNotes) => {
      const nextNotes = [...currentNotes];
      const restoreIndex = Math.min(deletedSnapshot.index, nextNotes.length);
      nextNotes.splice(restoreIndex, 0, restoredNote);
      return nextNotes;
    });
    setBackups((currentBackups) => {
      if (!deletedSnapshot.backup) {
        return currentBackups;
      }

      return {
        ...currentBackups,
        [restoredNote.id]: deletedSnapshot.backup
      };
    });
    setSelectedNoteId(restoredNote.id);
    setNoteMenuId(null);
    setRecentlyDeleted(null);
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setStatusMessage("삭제한 메모를 되돌렸다.");
  }

  async function openStickyNoteWindow() {
    const openStickyNote = window.desktopAPI?.window?.openStickyNote;

    if (!openStickyNote) {
      setStatusMessage("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있어요.");
      return;
    }

    try {
      await openStickyNote(activeNote?.id ?? null);
      setStatusMessage("새 스티커 메모 창을 열어두었어요.");
    } catch {
      setStatusMessage("스티커 메모 창을 열지 못했어요.");
    }
  }

  async function toggleStickyPinned() {
    if (!isDedicatedStickyWindow) {
      setStatusMessage("스티커 창에서만 고정 기능을 사용할 수 있어요.");
      return;
    }

    const setStickyPinned = window.desktopAPI?.window?.setStickyPinned;

    if (!setStickyPinned) {
      setStatusMessage("고정 기능을 사용할 수 없는 환경이다.");
      return;
    }

    try {
      const pinned = await setStickyPinned(!isStickyPinned);
      setIsStickyPinned(pinned);
      setStatusMessage(pinned ? "스티커 메모를 화면 맨 위에 고정했어요." : "스티커 메모 고정을 해제했어요.");
    } catch {
      setStatusMessage("스티커 메모 고정 상태를 바꾸지 못했어요.");
    }
  }

  function closeStickySurface() {
    if (isDedicatedStickyWindow) {
      window.close();
      return;
    }

    setIsStickyMode(false);
    setStatusMessage("일반 모드로 돌아왔다.");
  }

  const appShellClassName = [
    "app-shell",
    isMacOS ? "is-macos" : "",
    isStickyMode ? "is-sticky-mode" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const appBodyClassName = [
    "app-body",
    isSidebarOpen && !isStickyMode ? "" : "is-sidebar-hidden",
    isStickyMode ? "is-sticky-mode" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const paperStatusLabel = isMutationLocked
    ? "읽기 전용"
    : activeDraft
      ? "미리보기 전용"
      : recentlyDeleted
        ? "되돌리기 가능"
        : "로컬 저장 완료";
  const showPaperStatus = isMutationLocked || Boolean(activeDraft) || Boolean(recentlyDeleted);
  const sidebarCountLabel = hasQuery
    ? `결과 ${filteredNotes.length}개`
    : sidebarView === "favorites"
      ? `즐겨찾기 ${scopedNotes.length}개`
      : `메모 ${notes.length}개`;
  return (
    <main className="page" data-testid="page-root">
      <section className={appShellClassName} data-testid="app-shell">
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="status-live-region">
          {statusMessage}
        </div>
        <section className={appBodyClassName}>
          <aside className="sidebar" id="memo-sidebar">
            <div className="sidebar-head">
              <div className="sidebar-brand">
                <div className="sidebar-brand-copy">
                  <span className="sidebar-brand-text">
                    <strong>AI Note</strong>
                  </span>
                </div>

                <div className="sidebar-brand-actions">
                  <button
                    className="link-button sidebar-create-button"
                    type="button"
                    data-testid="sidebar-create-note-button"
                    aria-label="새 메모 만들기"
                    title="새 메모 만들기"
                    disabled={isMutationLocked}
                    onClick={() => void handleCreateNote()}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>

              <label className="sidebar-search">
                <SearchIcon />
                <span className="visually-hidden">메모 검색</span>
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="메모 검색"
                  data-testid="note-search-input"
                  value={query}
                  onChange={(event) => handleSearch(event.target.value)}
                />
                {hasQuery ? (
                  <button
                    className="sidebar-search-button"
                    type="button"
                    aria-label="검색어 지우기"
                    onClick={() => handleSearch("")}
                  >
                    지우기
                  </button>
                ) : null}
              </label>

              <nav className="sidebar-nav" aria-label="사이드바 탐색">
                <button
                  className={`sidebar-nav-item${sidebarView === "all" ? " is-active" : ""}`}
                  type="button"
                  data-testid="sidebar-all-view-button"
                  onClick={() => switchSidebarView("all")}
                >
                  <SidebarListIcon />
                  <span>전체 메모</span>
                </button>
                <button
                  className={`sidebar-nav-item${sidebarView === "favorites" ? " is-active" : ""}`}
                  type="button"
                  data-testid="sidebar-favorites-view-button"
                  onClick={() => switchSidebarView("favorites")}
                >
                  <SidebarFavoriteIcon />
                  <span>즐겨찾기</span>
                </button>
              </nav>
            </div>

            <div className="sidebar-section-heading">
              <span>{sidebarView === "favorites" ? "즐겨찾기" : "최근"}</span>
              <span>{sidebarCountLabel}</span>
            </div>

            {!isCollectionEmpty && filteredNotes.length > 0 ? (
              <ul className="note-list" aria-label="메모 목록" data-testid="note-list">
                {filteredNotes.map((note) => {
                  const isSelected = activeNote?.id === note.id;
                  const noteLabel = deriveNoteHeadline(note.body);
                  const isNoteMenuOpen = noteMenuId === note.id;
                  const noteMenuIdValue = `note-actions-menu-${note.id}`;
                  const handleSelectNote = () => {
                    setSelectedNoteId(note.id);
                    setDeleteIntentId(null);
                    setNoteMenuId(null);
                  };

                  return (
                    <li
                      key={note.id}
                      className={`note-list-item${isSelected ? " is-selected" : ""}`}
                      data-mode={note.mode}
                      onClick={handleSelectNote}
                    >
                      <button
                        className="note-list-item-button"
                        data-testid={`note-list-item-${note.id}`}
                        type="button"
                        aria-current={isSelected ? "true" : undefined}
                        aria-label={`${noteLabel} 메모`}
                        onClick={handleSelectNote}
                      >
                        <span className="note-list-copy">
                          <strong>{noteLabel}</strong>
                          <span className="note-list-date">{note.dateLabel === "이제" ? note.updatedAt : note.dateLabel}</span>
                        </span>
                      </button>
                      <div className="note-list-actions" data-note-menu-root="true" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="note-list-menu-button"
                          type="button"
                          data-testid={isSelected ? "selected-note-menu-button" : undefined}
                          aria-label={`${noteLabel} 메모 메뉴`}
                          aria-expanded={isNoteMenuOpen}
                          aria-controls={isNoteMenuOpen ? noteMenuIdValue : undefined}
                          onClick={() => toggleNoteMenu(note.id)}
                        >
                          <NoteMenuIcon />
                        </button>
                        {isNoteMenuOpen ? (
                          <div className="note-list-menu" id={noteMenuIdValue}>
                            <button
                              className="note-list-menu-item note-list-menu-item-danger"
                              type="button"
                              data-testid={isSelected ? "selected-note-delete-button" : undefined}
                              disabled={isMutationLocked}
                              onClick={() => beginDeleteNote(note.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <section className="note-list sidebar-empty" data-testid="sidebar-empty-state">
                <strong>
                  {isCollectionEmpty
                    ? "메모가 없어요"
                    : sidebarView === "favorites" && !hasQuery
                      ? "즐겨찾기가 없어요"
                      : "검색 결과가 없어요"}
                </strong>
                <p>
                  {isCollectionEmpty
                    ? "새 메모를 만들면 바로 목록에 나타나요."
                    : sidebarView === "favorites" && !hasQuery
                      ? "메모 오른쪽 위 별 버튼을 누르면 즐겨찾기 목록에 모아볼 수 있어요."
                      : "다른 검색어를 입력하거나 검색을 해제해 주세요."}
                </p>
                {storageStatusSummary ? (
                  <p
                    className={`sidebar-empty-status${storageHealth?.ready ? "" : " is-warning"}`}
                    data-testid="sidebar-storage-summary"
                  >
                    {storageStatusSummary}
                  </p>
                ) : null}
              </section>
            )}

            <footer className="sidebar-foot">
              <span className={`${storageBadgeClassName} sidebar-foot-badge`} data-testid="storage-status-badge">
                {storageBadgeLabel}
              </span>
              {storageStatusSummary ? <p>{storageStatusSummary}</p> : <p>모든 메모는 로컬 저장소에 바로 반영돼요.</p>}
            </footer>

          </aside>

          <section className="editor-pane">
            {isStickyMode ? (
              <div className="sticky-note-canvas">
                <article className="sticky-note-card">
                  <div className="sticky-note-toolbar" role="toolbar" aria-label="스티커 메모 도구" data-testid="sticky-toolbar">
                    <div className="sticky-note-toolbar__actions sticky-note-toolbar__actions--left">
                      <button
                        className="sticky-note-toolbar__button sticky-note-toolbar__button--close"
                        type="button"
                        data-testid="sticky-mode-exit-button"
                        aria-label={isDedicatedStickyWindow ? "스티커 창 닫기" : "일반 모드로 돌아가기"}
                        onClick={closeStickySurface}
                      >
                        <StickyCloseIcon />
                      </button>
                    </div>
                    <div className="sticky-note-toolbar__actions sticky-note-toolbar__actions--right">
                      <button
                        className={`sticky-note-toolbar__button sticky-note-toolbar__button--pin${isStickyPinned ? " is-pinned" : ""}`}
                        type="button"
                        data-testid="sticky-mode-pin-button"
                        aria-label={isStickyPinned ? "스티커 메모 고정 해제" : "스티커 메모 고정"}
                        aria-pressed={isStickyPinned}
                        onClick={() => void toggleStickyPinned()}
                      >
                        <StickyPinIcon />
                      </button>
                      <button
                        className="sticky-note-toolbar__button sticky-note-toolbar__button--new"
                        type="button"
                        data-testid="sticky-mode-new-note-button"
                        aria-label="새 스티커 메모 만들기"
                        disabled={isMutationLocked}
                        onClick={() => void handleCreateStickyNoteWindow()}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>

                  {activeNote ? (
                    <div className="sticky-note-body">
                      <label className="editor-field editor-field-body sticky-note-field">
                        <textarea
                          className="paper-editor sticky-note-editor"
                          data-testid="note-body-input"
                          ref={noteBodyInputRef}
                          value={activeNote.body}
                          placeholder="여기에 메모를 적어 주세요."
                          disabled={isMutationLocked}
                          readOnly={isMutationLocked}
                          onChange={(event) =>
                            patchActiveNote(
                              {
                                body: event.target.value,
                                mode: hasBackup ? activeNote.mode : "default"
                              },
                              "메모 내용을 수정했다."
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <section className="sticky-note-empty" data-testid="editor-empty-state">
                      <strong>메모가 없어요</strong>
                      <p>왼쪽 위 + 버튼으로 새 스티커 메모를 추가해 주세요.</p>
                    </section>
                  )}
                </article>

              </div>
            ) : (
              <div className="paper">
                <header className="paper-head">
                  <div className="paper-topline">
                    {showPaperStatus ? (
                      <div className="paper-heading paper-heading-compact">
                        <span className="paper-heading-status">{paperStatusLabel}</span>
                      </div>
                    ) : <div />}

                    <div className="paper-heading-tools">
                      <div className="paper-toolbar paper-toolbar-editor" role="toolbar" aria-label="메모 도구">
                        <div className="paper-toolbar-editor__group paper-toolbar-editor__group--left">
                          <button
                            className="paper-button paper-button-icon"
                            type="button"
                            data-testid="editor-toggle-sidebar-button"
                            aria-label={isSidebarOpen ? "목록 닫기" : "목록 열기"}
                            title={isSidebarOpen ? "목록 닫기" : "목록 열기"}
                            aria-controls="memo-sidebar"
                            aria-expanded={isSidebarOpen}
                            onClick={() => {
                              setIsSidebarOpen((current) => !current);
                            }}
                          >
                            <ToolbarSidebarIcon />
                          </button>
                        </div>
                        <div className="paper-toolbar-editor__group paper-toolbar-editor__group--right">
                          <button
                            className="paper-button paper-button-icon"
                            type="button"
                            data-testid="open-sticky-note-button"
                            aria-label="스티커 메모로 열기"
                            title="스티커 메모로 열기"
                            disabled={!activeNote}
                            onClick={() => void openStickyNoteWindow()}
                          >
                            <ToolbarStickyIcon />
                          </button>
                          {recentlyDeleted ? (
                            <button
                              className="status-button paper-button-icon"
                              type="button"
                              aria-label="되돌리기"
                              title="되돌리기"
                              disabled={isMutationLocked}
                              onClick={() => void undoDelete()}
                            >
                              <ToolbarUndoIcon />
                            </button>
                          ) : null}
                          {activeNote ? (
                            <button
                              className={`paper-button paper-button-icon editor-favorite-button${activeNote.favorite ? " is-favorite" : ""}`}
                              type="button"
                              data-testid="selected-note-favorite-button"
                              aria-label={activeNote.favorite ? "즐겨찾기를 해제해요" : "즐겨찾기에 추가해요"}
                              aria-pressed={activeNote.favorite}
                              onClick={() => toggleFavorite(activeNote.id)}
                            >
                              <NoteFavoriteIcon />
                            </button>
                          ) : null}
                          <button
                            className="paper-button paper-button-icon"
                            type="button"
                            data-testid="note-find-toggle-button"
                            aria-label="메모 안에서 찾기"
                            title="메모 안에서 찾기"
                            disabled={!activeNote || isStickyMode}
                            onClick={openFindBar}
                          >
                            <ToolbarFindIcon />
                          </button>
                          <button
                            className="paper-button paper-button-icon"
                            type="button"
                            data-testid="organize-note-button"
                            aria-label="AI로 정리하기"
                            title="AI로 정리하기"
                            disabled={isMutationLocked || isStickyMode || !activeNote}
                            onClick={openAiPromptComposer}
                          >
                            <ToolbarSparklesIcon />
                          </button>
                          <button
                            className="paper-button paper-button-icon paper-button-primary header-create-note-button"
                            type="button"
                            data-testid="editor-create-note-button"
                            aria-label="새 메모 만들기"
                            title="새 메모 만들기"
                            disabled={isMutationLocked}
                            onClick={() => void handleCreateNote()}
                          >
                            <PlusIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isFindBarOpen && activeNote && !activeDraft ? (
                    <div className="note-find-bar" role="search" aria-label="메모 안에서 찾기" data-testid="note-find-bar">
                      <label className="note-find-input-shell">
                        <ToolbarFindIcon />
                        <span className="visually-hidden">메모 안에서 찾기</span>
                        <input
                          ref={findInputRef}
                          type="search"
                          data-testid="note-find-input"
                          value={findQuery}
                          placeholder="이 메모에서 찾기"
                          onChange={(event) => {
                            setFindQuery(event.target.value);
                            setFindMatchIndex(0);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              moveFindMatch(event.shiftKey ? -1 : 1);
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeFindBar();
                            }
                          }}
                        />
                      </label>
                      <span className="note-find-count" data-testid="note-find-count">
                        {findQuery.trim().length === 0 ? "찾을 내용을 입력해 주세요" : `${findMatches.length === 0 ? 0 : findMatchIndex + 1}/${findMatches.length}`}
                      </span>
                      <div className="note-find-actions">
                        <button
                          className="paper-button paper-button-icon"
                          type="button"
                          data-testid="note-find-prev-button"
                          aria-label="이전 결과로 이동"
                          disabled={findMatches.length === 0}
                          onClick={() => moveFindMatch(-1)}
                        >
                          <ToolbarUndoIcon />
                        </button>
                        <button
                          className="paper-button paper-button-icon"
                          type="button"
                          data-testid="note-find-next-button"
                          aria-label="다음 결과로 이동"
                          disabled={findMatches.length === 0}
                          onClick={() => moveFindMatch(1)}
                        >
                          <ToolbarFindIcon />
                        </button>
                        <button
                          className="paper-button"
                          type="button"
                          data-testid="note-find-close-button"
                          onClick={closeFindBar}
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isAiPromptOpen ? (
                    <div className="ai-prompt-shell">
                      <form
                        id="ai-prompt-form"
                        className="ai-prompt-form"
                        data-testid="ai-prompt-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          startTransformPreview();
                        }}
                      >
                        <label className="ai-prompt-input">
                          <span className="visually-hidden">AI 정리 프롬프트</span>
                          <input
                            ref={aiPromptInputRef}
                            type="text"
                            data-testid="ai-prompt-input"
                            value={aiPrompt}
                            disabled={isMutationLocked}
                            placeholder="예: 더 간결하게 요약해줘, 존댓말로 바꿔줘"
                            onChange={(event) => setAiPrompt(event.target.value)}
                          />
                        </label>
                        {activeDraft ? (
                          <button
                            className="paper-button"
                            type="submit"
                            data-testid="submit-ai-prompt-button"
                            disabled={isMutationLocked}
                          >
                            다시 생성
                          </button>
                        ) : null}
                      </form>
                      <div className="ai-prompt-actions">
                        {hasBackup && !activeDraft ? (
                          <button
                            className="paper-button transform-restore-button"
                            type="button"
                            data-testid="restore-note-button"
                            disabled={isMutationLocked}
                            onClick={restoreOriginal}
                          >
                            원문 복원
                          </button>
                        ) : null}
                        {activeDraft ? (
                          <>
                            <button
                              className="paper-button"
                              type="button"
                              data-testid="cancel-transform-button"
                              onClick={cancelTransformPreview}
                            >
                              취소
                            </button>
                            <button
                              className="paper-button paper-button-primary"
                              type="button"
                              data-testid="apply-transform-button"
                              disabled={isMutationLocked}
                              onClick={applyTransformDraft}
                            >
                              적용
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="paper-button paper-button-primary"
                              type="submit"
                              form="ai-prompt-form"
                              data-testid="submit-ai-prompt-button"
                              disabled={isMutationLocked || isPreviewActionCoolingDown}
                            >
                              미리보기
                            </button>
                            <button
                              className="paper-button"
                              type="button"
                              data-testid="cancel-ai-prompt-button"
                              onClick={closeAiPromptComposer}
                            >
                              취소
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {isMutationLocked && storageHealth ? (
                    <div className="storage-lock-banner" role="alert" data-testid="storage-lock-alert">
                      <strong>편집 잠금</strong>
                      <span>{storageHealth.errorMessage ?? "저장소 연결 확인이 끝날 때까지 편집을 잠가두었어요."}</span>
                    </div>
                  ) : null}
                </header>

                <div className={`paper-body${activeDraft ? " is-preview-mode" : ""}`}>
                  {activeNote ? (
                    activeDraft ? (
                      <section className="transform-review-layout" data-testid="transform-preview">
                        <section className="transform-review-panel transform-review-panel--accent">
                          <div className="transform-review-panel-head">
                            <div className="transform-review-panel-copy">
                              <span className="transform-review-panel-label">제안 결과</span>
                              <strong>AI가 정리한 초안이에요</strong>
                              <p className="transform-review-panel-note">
                                위 프롬프트를 수정하고 다시 생성하면 아래 초안도 함께 바뀌어요.
                              </p>
                            </div>
                            {hasBackup ? (
                              <button
                                className="paper-button transform-restore-button"
                                type="button"
                                data-testid="restore-note-button"
                                disabled={isMutationLocked}
                                onClick={restoreOriginal}
                              >
                                원문으로 복원
                              </button>
                            ) : null}
                          </div>
                          <pre
                            className="transform-review-body"
                            data-testid="transform-preview-body"
                            tabIndex={0}
                            aria-label="AI가 정리한 미리보기 결과"
                          >
                            {activeDraft.previewBody}
                          </pre>
                        </section>

                        <aside
                          className="transform-review-panel transform-review-panel--source"
                          data-testid="transform-original-note"
                        >
                          <div className="transform-review-panel-head">
                            <div className="transform-review-panel-copy">
                              <span className="transform-review-panel-label">현재 원문</span>
                              <strong>적용 전 메모예요</strong>
                              <p className="transform-review-panel-note">
                                원문은 읽기 전용 비교 영역으로 그대로 보여드려요.
                              </p>
                            </div>
                          </div>
                          <pre
                            className="transform-review-body transform-review-body--source"
                            data-testid="transform-original-body"
                            tabIndex={0}
                            aria-label="현재 메모 원문"
                          >
                            {activeNote.body}
                          </pre>
                        </aside>
                      </section>
                    ) : (
                      <div className="editor-card">
                        <label className="editor-field editor-field-body">
                          <textarea
                            className="paper-editor"
                            data-testid="note-body-input"
                            ref={noteBodyInputRef}
                            value={activeNote.body}
                            placeholder="여기에 메모를 적어 주세요."
                            disabled={isMutationLocked}
                            readOnly={isMutationLocked}
                            onChange={(event) =>
                              patchActiveNote(
                                {
                                  body: event.target.value,
                                  mode: hasBackup ? activeNote.mode : "default"
                                },
                                "메모 내용을 수정했어요."
                              )
                            }
                          />
                        </label>
                      </div>
                    )
                  ) : (
                    <section className="editor-empty" data-testid="editor-empty-state">
                      <strong>
                        {isCollectionEmpty
                          ? "메모가 없어요"
                          : sidebarView === "favorites" && !hasQuery && !activeNote
                            ? "즐겨찾기 메모가 없어요"
                            : "선택한 메모가 없어요"}
                      </strong>
                      <p>
                        {isCollectionEmpty
                          ? "새 메모를 만들거나 방금 삭제한 메모를 되돌리면 다시 시작할 수 있어요."
                          : sidebarView === "favorites" && !hasQuery && !activeNote
                            ? "메모 오른쪽 위 별 버튼을 누르면 즐겨찾기만 따로 모아볼 수 있어요."
                            : "왼쪽 목록에서 메모를 선택하거나 새 메모를 만들어 주세요."}
                      </p>

                      <div className="empty-actions">
                        {!isSidebarOpen ? (
                          <button
                            className="paper-button"
                            type="button"
                            data-testid="empty-open-sidebar-button"
                            onClick={() => {
                              setIsSidebarOpen(true);
                            }}
                          >
                            목록 열기
                          </button>
                        ) : null}
                        <button
                          className="paper-button"
                          type="button"
                          data-testid="empty-create-note-button"
                          ref={emptyCreateButtonRef}
                          disabled={isMutationLocked}
                          onClick={() => void handleCreateNote()}
                        >
                          새 메모
                        </button>
                        {recentlyDeleted ? (
                          <button
                            className="paper-button"
                            type="button"
                            data-testid="empty-undo-delete-button"
                            disabled={isMutationLocked}
                            onClick={() => void undoDelete()}
                          >
                            되돌리기
                          </button>
                        ) : null}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            )}
          </section>
        </section>
        {isDeleteModalOpen && deleteTargetNote ? (
          <div className="delete-modal-backdrop" data-testid="delete-confirm-modal" onClick={cancelDeleteNote}>
            <section
              className="delete-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              aria-describedby="delete-modal-description"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <h2 id="delete-modal-title">메모를 삭제할까요?</h2>
              <p id="delete-modal-description">
                "{deleteTargetHeadline}" 메모를 삭제하면 되돌리기 전까지 사라집니다.
              </p>
              <div className="delete-modal-actions">
                <button className="paper-button" type="button" data-testid="cancel-delete-button" onClick={cancelDeleteNote}>
                  취소
                </button>
                <button
                  className="paper-button paper-button-danger"
                  type="button"
                  data-testid="confirm-delete-button"
                  disabled={isMutationLocked}
                  onClick={confirmDeleteNote}
                >
                  정말 삭제
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
