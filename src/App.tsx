import { useEffect, useMemo, useRef, useState } from "react";
import type { Memo, MemoChangeEvent, MemoCreateInput, MemoStoreHealth, MemoUpdateInput } from "./shared/memo";
import { buildMemoTitleFromBody, deriveNoteHeadline } from "./note-content";

type TransformMode = "default" | "organized";

type Note = {
  id: string;
  body: string;
  updatedAt: string;
  dateLabel: string;
  mode: TransformMode;
};

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
  noteId: string;
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
];

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
        updatedAt: incomingNote.updatedAt,
        dateLabel: incomingNote.dateLabel
      }
    : incomingNote;

  return [mergedNote, ...currentNotes.filter((note) => note.id !== mergedNote.id)];
}

function removeSyncedNote(currentNotes: Note[], memoId: string) {
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
  if (typeof update.body !== "string") {
    return {};
  }

  return {
    body: update.body,
    // 저장소/검색 계층과의 호환성을 위해 title은 본문 첫 줄에서 파생한다.
    title: buildMemoTitleFromBody(update.body)
  };
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
  requestedNoteId: string | null;
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
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 5l6 6M11 5l-6 6" />
    </svg>
  );
}

function StickyPinIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.2 2.6h3.6l.7 2.7 1.6 1.8v1H3.9v-1l1.6-1.8.7-2.7z" />
      <path d="M8 8.2v4" />
    </svg>
  );
}

function StickyNewNoteIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.4 3.1h7.2v9.8H4.4z" />
      <path d="M8 6.8v3.2M6.4 8.4h3.2" />
    </svg>
  );
}

function HeaderPlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </svg>
  );
}

function ToolbarStickyIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 3.1h7v9.8h-7z" />
      <path d="M6 5.7h4" />
      <path d="M6 8h4" />
    </svg>
  );
}

function ToolbarSidebarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.3 3.2h9.4v9.6H3.3z" />
      <path d="M6.2 3.2v9.6" />
    </svg>
  );
}

function ToolbarSparklesIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.7l1.1 2.8 2.8 1.1-2.8 1.1L8 10.5 6.9 7.7 4.1 6.6l2.8-1.1z" />
      <path d="M11.9 10.1l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" />
    </svg>
  );
}

function ToolbarUndoIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.1 5.1H3.7v2.4" />
      <path d="M3.8 7.5a4.7 4.7 0 1 1 2.6 4.2" />
    </svg>
  );
}

function NoteMenuIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.1 8h.01" />
      <path d="M8 8h.01" />
      <path d="M11.9 8h.01" />
    </svg>
  );
}

function App() {
  const launchContext = useMemo(() => readLaunchContext(), []);
  const isDedicatedStickyWindow = launchContext.stickyMode;
  const isMacOS =
    window.desktopAPI?.platform === "darwin" ||
    (typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  const [notes, setNotes] = useState(initialNotes);
  const [selectedNoteId, setSelectedNoteId] = useState(initialNotes[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!launchContext.stickyMode);
  const [isStickyMode, setIsStickyMode] = useState(launchContext.stickyMode);
  const [isStickyPinned, setIsStickyPinned] = useState(false);
  const [statusMessage, setStatusMessage] = useState("저장소 연결 상태를 확인하고 있다.");
  const [storageHealth, setStorageHealth] = useState<MemoStoreHealth | null>(null);
  const [isStorageLocked, setIsStorageLocked] = useState(true);
  const [backups, setBackups] = useState<Record<string, NoteBackup>>({});
  const [deleteIntentId, setDeleteIntentId] = useState<string | null>(null);
  const [noteMenuId, setNoteMenuId] = useState<string | null>(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedNoteState | null>(null);
  const [draftTransform, setDraftTransform] = useState<TransformDraft | null>(null);
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const aiPromptInputRef = useRef<HTMLInputElement | null>(null);
  const emptyCreateButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyFirstResultButtonRef = useRef<HTMLButtonElement | null>(null);
  const emptyClearSearchButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasQuery = query.trim().length > 0;
  const filteredNotes = useMemo(
    () => notes.filter((note) => matchesQuery(note, query)),
    [notes, query]
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
          errorMessage: "memoAPI 브리지를 찾지 못했다."
        });
        setIsStorageLocked(true);
        setNotes([]);
        setSelectedNoteId("");
        setStatusMessage("메모 저장소 브리지가 연결되지 않아 편집을 잠갔다.");
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
                errorMessage: "memoAPI.health 핸들러를 찾지 못했다."
              };

        if (cancelled) {
          return;
        }

        setStorageHealth(health);

        if (!health.ready) {
          setIsStorageLocked(true);
          setNotes([]);
          setSelectedNoteId("");
          setStatusMessage(`저장소 연결 실패: ${health.errorMessage ?? "원인을 확인할 수 없다."}`);
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
              ? `SQLite 초기화 실패로 ${storageLabel} 저장소를 사용 중이다.`
              : `${storageLabel} 저장소를 불러왔다.`
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
            ? `SQLite 초기화 실패로 ${storageLabel} 저장소를 초기화했다.`
            : `${storageLabel} 저장소를 초기화했다.`
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
          setStatusMessage(`저장소 연결이 중단되어 편집을 잠갔다: ${message}`);
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

    if (selectedNote) {
      return;
    }

    if (hasQuery && filteredNotes.length > 0) {
      setSelectedNoteId(filteredNotes[0].id);
      return;
    }

    if (selectedNoteId !== notes[0].id) {
      setSelectedNoteId(notes[0].id);
    }
  }, [filteredNotes, hasQuery, notes, selectedNote, selectedNoteId]);

  const activeNote = useMemo(() => {
    if (notes.length === 0) {
      return null;
    }

    if (hasQuery) {
      if (filteredNotes.length === 0) {
        return null;
      }

      return filteredNotes.find((note) => note.id === selectedNoteId) ?? null;
    }

    return selectedNote ?? notes[0];
  }, [filteredNotes, hasQuery, notes, selectedNote, selectedNoteId]);

  const isCollectionEmpty = notes.length === 0;
  const isSelectionOutsideSearch =
    hasQuery && Boolean(selectedNote) && !filteredNotes.some((note) => note.id === selectedNoteId);
  const hasBackup = activeNote ? Boolean(backups[activeNote.id]) : false;
  const activeDraft =
    draftTransform && activeNote && draftTransform.noteId === activeNote.id ? draftTransform : null;
  const noteCountLabel = isCollectionEmpty
    ? "메모가 없다"
    : hasQuery
      ? `${filteredNotes.length}개의 검색 결과`
      : `${notes.length}개의 메모`;
  const deleteTargetNote = deleteIntentId ? notes.find((note) => note.id === deleteIntentId) ?? null : null;
  const deleteTargetHeadline = deleteTargetNote ? deriveNoteHeadline(deleteTargetNote.body) : "";
  const isDeleteModalOpen = Boolean(deleteTargetNote);
  const isMutationLocked = isStorageLocked || !storageHealth?.ready;
  const storageKindLabel = storageHealth ? getStorageKindLabel(storageHealth.storeKind) : "확인 중";
  const storageBadgeLabel = storageHealth
    ? `저장소 ${storageKindLabel}`
    : "저장소 확인 중";
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
    if (activeNote || !hasQuery || typeof document === "undefined") {
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
  }, [activeNote, hasQuery, isSelectionOutsideSearch]);

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

    if ((hasQuery && !filteredNotes.some((note) => note.id === noteMenuId)) || !notes.some((note) => note.id === noteMenuId)) {
      setNoteMenuId(null);
    }
  }, [filteredNotes, hasQuery, noteMenuId, notes]);

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
    setIsAiPromptOpen(false);
  }, [isStickyMode]);

  function patchActiveNote(update: Partial<Note>, message?: string) {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 편집이 잠겨 있다.");
      return;
    }

    if (!activeNote) {
      return;
    }

    const activeNoteId = activeNote.id;
    const stamp = nowStamp();

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === activeNoteId
          ? {
              ...note,
              ...update,
              updatedAt: stamp.updatedAt,
              dateLabel: update.dateLabel ?? stamp.dateLabel
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
          setStatusMessage("메모 변경을 저장소에 반영하지 못했다.");
        });
    }

    if (message) {
      setStatusMessage(message);
    }
  }

  async function handleCreateNote() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 새 메모를 만들 수 없다.");
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
        setStatusMessage("새 메모를 만들지 못했다.");
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
    setStatusMessage("새 메모를 만들고 바로 편집 상태로 열었다.");
  }

  function handleSearch(nextQuery: string) {
    const trimmedQuery = nextQuery.trim();
    const matchingNotes = notes.filter((note) => matchesQuery(note, nextQuery));

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

      setStatusMessage("전체 메모를 다시 보고 있다.");
      return;
    }

    if (selectedNote && matchesQuery(selectedNote, nextQuery)) {
      setStatusMessage(`"${trimmedQuery}" 검색 결과 ${matchingNotes.length}개에서 현재 메모를 유지하고 있다.`);
      return;
    }

    if (matchingNotes.length > 0) {
      setStatusMessage(`"${trimmedQuery}" 검색 결과 ${matchingNotes.length}개다. 목록에서 메모를 선택하세요.`);
      return;
    }

    setStatusMessage(`"${trimmedQuery}"에 맞는 메모를 찾지 못했다.`);
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
      setStatusMessage("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없다.");
      return;
    }

    if (!activeNote) {
      return;
    }

    setDeleteIntentId(null);
    setNoteMenuId(null);
    setAiPrompt((currentPrompt) => currentPrompt || activeDraft?.prompt || "");
    setIsAiPromptOpen(true);
    setStatusMessage("AI 정리 프롬프트 입력창을 열었다.");
  }

  function closeAiPromptComposer() {
    setIsAiPromptOpen(false);
    setAiPrompt("");
    setStatusMessage("AI 정리 입력창을 닫았다.");
  }

  function startTransformPreview() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없다.");
      return;
    }

    if (!activeNote) {
      return;
    }

    if (!activeNote.body.trim()) {
      setStatusMessage("본문이 비어 있어서 정리할 내용이 없다.");
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
    setIsAiPromptOpen(false);
    setStatusMessage(trimmedPrompt ? "AI 정리 미리보기를 만들었다." : "기본 AI 정리 미리보기를 만들었다.");
  }

  function cancelTransformPreview() {
    setNoteMenuId(null);
    setDraftTransform(null);
    setStatusMessage("미리보기를 닫았다.");
  }

  function applyTransformDraft() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 미리보기를 적용할 수 없다.");
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
      activeDraft.prompt ? "AI 정리 결과를 현재 메모에 반영했다." : "기본 AI 정리 결과를 반영했다."
    );
  }

  function restoreOriginal() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 원문 복원을 실행할 수 없다.");
      return;
    }

    if (!activeNote || !backups[activeNote.id]) {
      setStatusMessage("복원할 원문이 없다.");
      return;
    }

    const original = backups[activeNote.id];

    patchActiveNote(
      {
        body: original.body,
        mode: original.mode
      },
      "원문 상태로 다시 복원했다."
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

  function beginDeleteNote(noteId?: string) {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 삭제를 실행할 수 없다.");
      return;
    }

    const targetNote =
      (noteId ? notes.find((note) => note.id === noteId) ?? null : null) ??
      activeNote;

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
    setStatusMessage("삭제를 취소했다.");
  }

  function toggleNoteMenu(noteId: string) {
    setDeleteIntentId(null);
    setNoteMenuId((currentNoteMenuId) => (currentNoteMenuId === noteId ? null : noteId));
  }

  function confirmDeleteNote() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 삭제를 실행할 수 없다.");
      return;
    }

    if (!deleteTargetNote) {
      setDeleteIntentId(null);
      return;
    }

    const deletedNoteId = deleteTargetNote.id;
    const deletedBackup = backups[deleteTargetNote.id] ?? null;
    const currentVisibleNotes = hasQuery ? filteredNotes : notes;
    const deletedIndex = notes.findIndex((note) => note.id === deleteTargetNote.id);
    const deletedVisibleIndex = currentVisibleNotes.findIndex((note) => note.id === deleteTargetNote.id);
    const shouldKeepSelection = selectedNoteId.length > 0 && selectedNoteId !== deleteTargetNote.id;

    if (deletedIndex < 0) {
      setDeleteIntentId(null);
      return;
    }

    const nextNotes = notes.filter((note) => note.id !== deleteTargetNote.id);
    const visibleNotes = hasQuery ? nextNotes.filter((note) => matchesQuery(note, query)) : nextNotes;
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
    setStatusMessage("메모를 삭제했습니다. 되돌릴 수 있다.");

    if (window.memoAPI) {
      void window.memoAPI.delete(deletedNoteId).catch(() => {
        setStatusMessage("메모 삭제를 저장소에 반영하지 못했다.");
      });
    }
  }

  async function undoDelete() {
    if (isMutationLocked) {
      setStatusMessage("저장소 연결이 복구될 때까지 되돌리기를 실행할 수 없다.");
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
        setStatusMessage("삭제 복원을 저장소에 반영하지 못했다.");
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
      setStatusMessage("스티커 메모는 데스크톱 앱에서만 새 창으로 열 수 있다.");
      return;
    }

    try {
      await openStickyNote(activeNote?.id ?? null);
      setStatusMessage("새 스티커 메모 창을 열었다.");
    } catch {
      setStatusMessage("스티커 메모 창을 열지 못했다.");
    }
  }

  async function toggleStickyPinned() {
    if (!isDedicatedStickyWindow) {
      setStatusMessage("스티커 창에서만 고정 기능을 사용할 수 있다.");
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
      setStatusMessage(pinned ? "스티커 메모를 화면 최상단에 고정했다." : "스티커 메모 고정을 해제했다.");
    } catch {
      setStatusMessage("스티커 메모 고정 상태를 변경하지 못했다.");
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
                <strong>AI Note</strong>

                <div className="sidebar-brand-actions">
                  <button
                    className="link-button link-button-primary"
                    type="button"
                    data-testid="sidebar-create-note-button"
                    disabled={isMutationLocked}
                    onClick={() => void handleCreateNote()}
                  >
                    새 메모
                  </button>
                </div>
              </div>

              <label className="sidebar-search">
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

              <div className="sidebar-summary">
                <span>{noteCountLabel}</span>
                <span className={storageBadgeClassName} data-testid="storage-status-badge">
                  {storageBadgeLabel}
                </span>
              </div>
            </div>

            <div className="note-list" role="listbox" aria-label="메모 목록" data-testid="note-list">
              {!isCollectionEmpty && filteredNotes.length > 0 ? (
                filteredNotes.map((note) => {
                  const isSelected = activeNote?.id === note.id;
                  const noteLabel = deriveNoteHeadline(note.body);
                  const isNoteMenuOpen = noteMenuId === note.id;
                  const noteMenuIdValue = `note-actions-menu-${note.id}`;

                  return (
                    <div
                      key={note.id}
                      className={`note-list-item${isSelected ? " is-selected" : ""}`}
                      data-mode={note.mode}
                    >
                      <button
                        className="note-list-item-button"
                        data-testid={`note-list-item-${note.id}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-current={isSelected ? "true" : undefined}
                        aria-label={`${noteLabel} 메모`}
                        onClick={() => {
                          setSelectedNoteId(note.id);
                          setDeleteIntentId(null);
                          setNoteMenuId(null);
                        }}
                      >
                        <span className="note-list-copy">
                          <span className="note-list-meta">
                            <span className="note-list-state">{note.mode === "default" ? "원문" : "AI 정리"}</span>
                          </span>
                          <strong>{noteLabel}</strong>
                          <span className="note-list-preview">{note.dateLabel}</span>
                        </span>
                      </button>
                      <div className="note-list-actions" data-note-menu-root="true">
                        <button
                          className="note-list-menu-button"
                          type="button"
                          data-testid={isSelected ? "selected-note-menu-button" : undefined}
                          aria-label={`${noteLabel} 메모 메뉴`}
                          aria-haspopup="menu"
                          aria-expanded={isNoteMenuOpen}
                          aria-controls={isNoteMenuOpen ? noteMenuIdValue : undefined}
                          onClick={() => toggleNoteMenu(note.id)}
                        >
                          <NoteMenuIcon />
                        </button>
                        {isNoteMenuOpen ? (
                          <div className="note-list-menu" id={noteMenuIdValue} role="menu">
                            <button
                              className="note-list-menu-item note-list-menu-item-danger"
                              type="button"
                              role="menuitem"
                              data-testid={isSelected ? "selected-note-delete-button" : undefined}
                              disabled={isMutationLocked}
                              onClick={() => beginDeleteNote(note.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <section className="sidebar-empty" data-testid="sidebar-empty-state">
                  <strong>{isCollectionEmpty ? "메모가 없습니다" : "검색 결과가 없습니다"}</strong>
                  <p>
                    {isCollectionEmpty
                      ? "새 메모를 만들면 바로 목록에 나타난다."
                      : "다른 검색어를 입력하거나 검색을 해제하세요."}
                  </p>
                </section>
              )}
            </div>

          </aside>

          <section className="editor-pane">
            {isStickyMode ? (
              <div className="sticky-note-toolbar" role="toolbar" aria-label="스티커 메모 도구" data-testid="sticky-toolbar">
                <div className="sticky-note-toolbar__drag" aria-hidden="true" />
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
                </div>
                <div className="sticky-note-toolbar__actions sticky-note-toolbar__actions--right">
                  <button
                    className="sticky-note-toolbar__button sticky-note-toolbar__button--new"
                    type="button"
                    data-testid="sticky-mode-new-note-button"
                    aria-label="새 메모 만들기"
                    disabled={isMutationLocked}
                    onClick={() => void handleCreateNote()}
                  >
                    <StickyNewNoteIcon />
                  </button>
                </div>
              </div>
            ) : null}
            {activeNote ? (
              <div className="paper">
                <header className="paper-head">
                  <div className="paper-utility-bar">
                    <div className="paper-toolbar paper-toolbar-editor" role="toolbar" aria-label="메모 도구">
                      <button
                        className="paper-button paper-button-icon"
                        type="button"
                        data-testid="open-sticky-note-button"
                        aria-label="스티커 메모 열기"
                        title="스티커 메모"
                        onClick={() => void openStickyNoteWindow()}
                      >
                        <ToolbarStickyIcon />
                      </button>
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
                      <button
                        className="paper-button paper-button-icon paper-button-primary"
                        type="button"
                        data-testid="organize-note-button"
                        aria-label="AI 정리"
                        title="AI 정리"
                        disabled={isMutationLocked}
                        onClick={openAiPromptComposer}
                      >
                        <ToolbarSparklesIcon />
                      </button>
                      <button
                        className="paper-button paper-button-icon paper-button-primary"
                        type="button"
                        data-testid="editor-create-note-button"
                        aria-label="새 메모 만들기"
                        title="새 메모 만들기"
                        disabled={isMutationLocked}
                        onClick={() => void handleCreateNote()}
                      >
                        <HeaderPlusIcon />
                      </button>
                    </div>
                  </div>

                  {isAiPromptOpen ? (
                    <form
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
                      <div className="ai-prompt-actions">
                        {hasBackup ? (
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
                        <button
                          className="paper-button paper-button-primary"
                          type="submit"
                          data-testid="submit-ai-prompt-button"
                          disabled={isMutationLocked}
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
                      </div>
                    </form>
                  ) : null}
                  {isMutationLocked && storageHealth ? (
                    <div className="storage-lock-banner" role="alert" data-testid="storage-lock-alert">
                      <strong>편집 잠금</strong>
                      <span>{storageHealth.errorMessage ?? "저장소 연결 확인이 완료될 때까지 편집을 잠갔다."}</span>
                    </div>
                  ) : null}
                </header>

                <div className="paper-body">
                  {activeDraft ? (
                    <section className="transform-preview" data-testid="transform-preview">
                      <div className="transform-preview-head">
                        <div className="transform-preview-copy">
                          <strong>AI 정리 미리보기</strong>
                          <span>{activeDraft.prompt ? `프롬프트: ${activeDraft.prompt}` : "기본 정리"}</span>
                        </div>
                      </div>
                      <pre className="transform-preview-body">{activeDraft.previewBody}</pre>
                      <div className="transform-original" data-testid="transform-original-note">
                        <div className="transform-original-head">
                          <strong>원본 메모</strong>
                          <span>{deriveNoteHeadline(activeNote.body)}</span>
                        </div>
                        <pre className="transform-original-body" data-testid="transform-original-body">
                          {activeNote.body}
                        </pre>
                      </div>
                      <div className="transform-preview-actions">
                        {hasBackup ? (
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
                      </div>
                    </section>
                  ) : null}

                  <div className="editor-card">
                    <label className="editor-field editor-field-body">
                      <textarea
                        className={`paper-editor${activeDraft ? " is-readonly" : ""}`}
                        data-testid="note-body-input"
                        value={activeNote.body}
                        placeholder="여기에 메모를 적으세요."
                        disabled={isMutationLocked}
                        readOnly={Boolean(activeDraft) || isMutationLocked}
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
                </div>
              </div>
            ) : (
              <section className="editor-empty" data-testid="editor-empty-state">
                <strong>
                  {isCollectionEmpty
                    ? "메모가 없습니다"
                    : isSelectionOutsideSearch
                      ? "현재 메모가 검색 결과에 없습니다"
                      : "찾은 메모가 없습니다"}
                </strong>
                <p>
                  {isCollectionEmpty
                    ? "새 메모를 만들거나 이전 삭제를 되돌리면 다시 시작할 수 있다."
                    : isSelectionOutsideSearch
                      ? "검색 결과 목록에서 다른 메모를 선택하거나 첫 결과를 바로 열 수 있다."
                      : "다른 검색어를 입력하거나 검색을 해제하세요."}
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
                  {isSelectionOutsideSearch && filteredNotes[0] ? (
                    <button
                      className="paper-button"
                      type="button"
                      data-testid="empty-open-first-result-button"
                      ref={emptyFirstResultButtonRef}
                      onClick={() => {
                        setSelectedNoteId(filteredNotes[0].id);
                      }}
                    >
                      첫 결과 열기
                    </button>
                  ) : null}
                  {hasQuery ? (
                    <button
                      className="paper-button"
                      type="button"
                      data-testid="empty-clear-search-button"
                      ref={emptyClearSearchButtonRef}
                      onClick={() => handleSearch("")}
                    >
                      검색 해제
                    </button>
                  ) : null}
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
