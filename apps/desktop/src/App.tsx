import { useEffect, useMemo, useRef, useState } from "react";
import type { MemoCategory, MemoId } from "@ai-note/shared/memo";
import { createNoteCategoryDefinitions, mergeCategoryDefinitions } from "./domain/categories";
import {
  matchesQuery,
} from "./domain/note";
import type { Note } from "./domain/note";
import type { TransformSession } from "./domain/transform";
import { createInitialComposeSession } from "./domain/compose-session";
import type { SidebarSearchMode, SidebarSurface, SidebarView } from "./domain/workspace";
import { initialNotes } from "./domain/initial-notes";
import { getStorageKindLabel, getStorageStatusSummary } from "./domain/storage-status";
import { readLaunchContext } from "./domain/launch-context";
import { isMacOSPlatform } from "./infrastructure/desktop-window";
import { useResizablePanels } from "./hooks/useResizablePanels";
import { useAiChatController } from "./hooks/useAiChatController";
import { useAppShellLayout } from "./hooks/useAppShellLayout";
import { useComposeController } from "./hooks/useComposeController";
import { useContextSearchController } from "./hooks/useContextSearchController";
import { useDeleteNoteController } from "./hooks/useDeleteNoteController";
import { useFindController } from "./hooks/useFindController";
import { useMemoCategoryController } from "./hooks/useMemoCategoryController";
import { useMemoSyncEffects } from "./hooks/useMemoSyncEffects";
import { patchActiveNoteWithPersistence, useNoteMutationActions } from "./hooks/useNoteMutationActions";
import { useNotesBootstrap } from "./hooks/useNotesBootstrap";
import { usePromptTemplates } from "./hooks/usePromptTemplates";
import { useSidebarSearchController } from "./hooks/useSidebarSearchController";
import { useStickyModeController } from "./hooks/useStickyModeController";
import { useTransformController } from "./hooks/useTransformController";
import { AiChatPanel } from "./components/AiChatPanel";
import { ComposeWorkspace } from "./components/ComposeWorkspace";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { EditorWorkspace } from "./components/EditorWorkspace";
import { Sidebar } from "./components/Sidebar";
import { StickyNotePane } from "./components/StickyNotePane";

function App() {
  const launchContext = useMemo(() => readLaunchContext(), []);
  const isDedicatedStickyWindow = launchContext.stickyMode;
  const isMacOS = isMacOSPlatform();
  const [statusMessage, setStatusMessage] = useState("저장소 연결 상태를 확인하고 있어요.");
  const {
    notes,
    setNotes,
    selectedNoteId,
    setSelectedNoteId,
    storageHealth,
    isStorageLocked
  } = useNotesBootstrap({
    initialNotes,
    requestedNoteId: launchContext.requestedNoteId,
    setStatusMessage
  });
  const [query, setQuery] = useState("");
  const [sidebarView, setSidebarView] = useState<SidebarView>("all");
  const [isSidebarOpen, setIsSidebarOpen] = useState(!launchContext.stickyMode);
  const [isStickyMode, setIsStickyMode] = useState(launchContext.stickyMode);
  const [isStickyPinned, setIsStickyPinned] = useState(false);
  const [deleteIntentId, setDeleteIntentId] = useState<MemoId | null>(null);
  const [noteMenuId, setNoteMenuId] = useState<MemoId | null>(null);
  const [activeSidebarSurface, setActiveSidebarSurface] = useState<SidebarSurface>("notes");
  const [sidebarSearchMode, setSidebarSearchMode] = useState<SidebarSearchMode>("keyword");
  const { sidebarWidth, chatWidth, startSidebarResize, startChatResize } = useResizablePanels();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const aiPromptInputRef = useRef<HTMLInputElement | null>(null);
  const aiChatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const aiChatThreadRef = useRef<HTMLDivElement | null>(null);
  const noteBodyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const emptyCreateButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMutationLocked = isStorageLocked || !storageHealth?.ready;
  const isComposeScreenOpen = !isStickyMode && activeSidebarSurface === "compose";
  const {
    contextSearch,
    setContextSearch,
    openContextSearchPanel,
    closeContextSearchPanel,
    runContextSearch,
    openNoteFromContextSearch
  } = useContextSearchController({
    closeActiveTransformSession,
    closeFindBar,
    setActiveSidebarSurface,
    setDeleteIntentId,
    setNoteMenuId,
    setSelectedNoteId,
    setSidebarSearchMode,
    setStatusMessage
  });
  const {
    composeSession,
    setComposeSession,
    composePromptInputRef,
    isComposeAnimating,
    isComposeBusy,
    isComposeGenerating,
    openComposeSession,
    closeComposeSession,
    startComposeDraft
  } = useComposeController({
    closeActiveTransformSession,
    closeFindBar,
    isComposeScreenOpen,
    setActiveSidebarSurface,
    setContextSearch,
    setDeleteIntentId,
    setNoteMenuId,
    setNotes,
    setSelectedNoteId,
    setStatusMessage
  });
  const {
    isAiChatOpen,
    setIsAiChatOpen,
    aiChatInput,
    setAiChatInput,
    aiChatMessages,
    aiChatMode,
    setAiChatMode,
    aiChatStatus,
    isAiChatThinking,
    isChatExpanded,
    cancelAiChatRequest,
    closeAiChatPanel,
    toggleAiChatPanel,
    submitAiChatPrompt,
    openNoteFromAiChat
  } = useAiChatController({
    isStickyMode,
    isMutationLocked,
    setStatusMessage,
    setContextSearch,
    setComposeSession,
    setDeleteIntentId,
    setNoteMenuId,
    setNotes,
    setSelectedNoteId,
    setQuery,
    setSidebarSearchMode,
    setActiveSidebarSurface,
    closeFindBar
  });

  const {
    categorizingNoteIds,
    categories,
    categoryFilter,
    isCategorizingAll,
    createCategory,
    updateCategory,
    deleteCategory,
    deleteUnusedCategories,
    setCategoryFilter,
    setNoteCategory,
    runAiCategorize,
    runCategorizeAllUncategorized
  } = useMemoCategoryController({
    isMutationLocked,
    notes,
    setNotes,
    setStatusMessage
  });

  const hasQuery = sidebarSearchMode === "keyword" && query.trim().length > 0;
  const scopedNotes = useMemo(
    () =>
      notes.filter((note) => {
        if (sidebarView === "favorites" && !note.favorite) return false;
        if (categoryFilter !== "all" && note.category !== categoryFilter) return false;
        return true;
      }),
    [notes, sidebarView, categoryFilter]
  );
  const filteredNotes = useMemo(
    () => scopedNotes.filter((note) => matchesQuery(note, query)),
    [scopedNotes, query]
  );
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const visibleCategories = useMemo(
    () => mergeCategoryDefinitions(categories, createNoteCategoryDefinitions(notes)),
    [categories, notes]
  );
  const categoryCounts = useMemo(
    () =>
      visibleCategories.reduce(
        (counts, category) => ({
          ...counts,
          [category.id]: notes.filter((note) => note.category === category.id).length
        }),
        {} as Record<MemoCategory, number>
      ),
    [notes, visibleCategories]
  );

  const activeNote = useMemo(() => {
    if (notes.length === 0) {
      return null;
    }

    if (sidebarView === "favorites" || categoryFilter !== "all") {
      if (scopedNotes.length === 0) {
        return null;
      }

      return scopedNotes.find((note) => note.id === selectedNoteId) ?? null;
    }

    return selectedNote ?? notes[0];
  }, [categoryFilter, notes, scopedNotes, selectedNote, selectedNoteId, sidebarView]);
  const {
    committedFindQuery,
    findInputRef,
    findMatches,
    findMatchIndex,
    findQuery,
    isFindBarOpen,
    setFindQuery,
    openFindBar: openFindBarFromHook,
    closeFindBar: closeFindBarFromHook,
    searchFind: searchFindFromHook
  } = useFindController({
    activeNote,
    isStickyMode,
    noteBodyInputRef,
    closeActiveTransformSession,
    setStatusMessage
  });

  const isCollectionEmpty = notes.length === 0;
  const isSelectionOutsideCurrentSidebarScope =
    sidebarView === "favorites" && Boolean(selectedNote) && !scopedNotes.some((note) => note.id === selectedNoteId);
  const {
    activeAiPrompt,
    activeDraft,
    activeTransformSession,
    activeTransformFeedback,
    hasBackup,
    isActiveNoteBusy,
    isAiPromptOpen,
    isAnyTransformGenerating,
    isPreviewActionCoolingDown,
    isTransformPreviewGenerating,
    previewDiffSegments,
    setBackups,
    setOrganizingNotes,
    setTransformSession,
    openTransformSession: openTransformSessionFromHook,
    closeActiveTransformSession: closeActiveTransformSessionFromHook,
    updateActiveTransformSession: updateActiveTransformSessionFromHook,
    startTransformPreview,
    cancelTransformPreview,
    applyTransformDraft,
    restoreOriginal
  } = useTransformController({
    activeNote,
    isMutationLocked,
    isStickyMode,
    patchActiveNote,
    setActiveSidebarSurface,
    setDeleteIntentId,
    setNoteMenuId,
    setStatusMessage
  });
  useMemoSyncEffects({
    notes,
    scopedNotes,
    selectedNote,
    selectedNoteId,
    sidebarView,
    setBackups,
    setDeleteIntentId,
    setNoteMenuId,
    setNotes,
    setOrganizingNotes,
    setSelectedNoteId,
    setTransformSession
  });
  const {
    closeStickySurface,
    handleOpenStickyNoteWindow,
    toggleStickyPinned
  } = useStickyModeController({
    activeNote,
    isDedicatedStickyWindow,
    isStickyPinned,
    setIsStickyMode,
    setIsStickyPinned,
    setStatusMessage
  });
  const {
    promptTemplates,
    promptTemplateEditor,
    setPromptTemplateEditor,
    closePromptTemplateEditor,
    openPromptTemplateEditor,
    applyPromptTemplate,
    persistPromptTemplate,
    removePromptTemplate
  } = usePromptTemplates({ activeAiPrompt, updateActiveTransformSession, setStatusMessage });
  const {
    handleCreateNote,
    handleCreateStickyNoteWindow,
    switchSidebarView,
    toggleFavorite
  } = useNoteMutationActions({
    activeNote,
    categoryFilter,
    hasQuery,
    isMutationLocked,
    setDeleteIntentId,
    setNoteMenuId,
    setNotes,
    setQuery,
    setSelectedNoteId,
    setSidebarView,
    setStatusMessage
  });
  const { handleSearch } = useSidebarSearchController({
    closeActiveTransformSession,
    closeFindBar,
    scopedNotes,
    selectedNote,
    sidebarSearchMode,
    sidebarView,
    setActiveSidebarSurface,
    setComposeSession,
    setContextSearch,
    setDeleteIntentId,
    setNoteMenuId,
    setQuery,
    setSelectedNoteId,
    setStatusMessage
  });
  const {
    beginDeleteNote,
    cancelDeleteNote,
    confirmDeleteNote,
    deleteTargetHeadline,
    deleteTargetNote,
    isDeleteModalOpen,
    toggleNoteMenu
  } = useDeleteNoteController({
    activeNote,
    closeActiveTransformSession,
    deleteIntentId,
    filteredNotes,
    hasQuery,
    isMutationLocked,
    noteMenuId,
    notes,
    query,
    scopedNotes,
    selectedNoteId,
    sidebarView,
    setBackups,
    setDeleteIntentId,
    setNoteMenuId,
    setNotes,
    setSelectedNoteId,
    setStatusMessage
  });
  const isEditorLocked = isMutationLocked || isActiveNoteBusy;
  const storageKindLabel = storageHealth ? getStorageKindLabel(storageHealth.storeKind) : "확인 중";
  const storageBadgeLabel = storageHealth
    ? `저장소 ${storageKindLabel}`
    : "저장소 확인 중";
  const storageStatusSummary = getStorageStatusSummary(storageHealth);
  const shouldShowStorageNotice = storageHealth?.storeKind === "json";
  const storageBadgeClassName = [
    "storage-status-badge",
    storageHealth ? `is-${storageHealth.storeKind}` : "is-loading",
    storageHealth?.ready ? "" : "is-error"
  ]
    .filter(Boolean)
    .join(" ");

  function openTransformSession(noteId: MemoId, nextPrompt?: string) {
    openTransformSessionFromHook(noteId, nextPrompt);
  }

  function closeActiveTransformSession({ clearDraft = false, clearPrompt = false, clearFeedback = true } = {}) {
    closeActiveTransformSessionFromHook({ clearDraft, clearPrompt, clearFeedback });
  }

  function updateActiveTransformSession(updater: (session: TransformSession) => TransformSession | null) {
    updateActiveTransformSessionFromHook(updater);
  }

  useEffect(() => {
    if (!isAiPromptOpen) {
      return;
    }

    aiPromptInputRef.current?.focus();
    aiPromptInputRef.current?.select();
  }, [isAiPromptOpen]);

  useEffect(() => {
    if (!isAiPromptOpen) {
      closePromptTemplateEditor();
    }
  }, [isAiPromptOpen]);

  useEffect(() => {
    if (!isAiChatOpen) {
      return;
    }

    aiChatInputRef.current?.focus();
  }, [isAiChatOpen]);

  useEffect(() => {
    if (!isAiChatOpen) {
      return;
    }

    const thread = aiChatThreadRef.current;

    if (!thread) {
      return;
    }

    thread.scrollTop = thread.scrollHeight;
  }, [aiChatMessages, aiChatStatus, isAiChatOpen]);

  useEffect(() => {
    if (activeSidebarSurface !== "ai-context") {
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [activeSidebarSurface]);

  useEffect(() => {
    if (!isStickyMode && activeSidebarSurface === "ai-context") {
      return;
    }

    setContextSearch((currentSearch) => ({
      ...currentSearch,
      results: [],
      hasSearched: false,
      isLoading: false
    }));
  }, [activeNote?.id, activeSidebarSurface, isStickyMode]);

  useEffect(() => {
    if (activeNote || typeof document === "undefined") {
      return;
    }

    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }

    const nextTarget =
      searchInputRef.current;

    nextTarget?.focus();
  }, [activeNote, isSelectionOutsideCurrentSidebarScope]);

  useEffect(() => {
    if (!isStickyMode) {
      setIsStickyPinned(false);
      return;
    }

    setIsSidebarOpen(false);
    setDeleteIntentId(null);
    setNoteMenuId(null);
    setTransformSession(null);
    setComposeSession(createInitialComposeSession());
    setActiveSidebarSurface("notes");
    setIsAiChatOpen(false);
  }, [isStickyMode]);

  function patchActiveNote(update: Partial<Note>, message?: string) {
    patchActiveNoteWithPersistence(update, message, {
      activeNote,
      hasQuery,
      isMutationLocked,
      setDeleteIntentId,
      setNoteMenuId,
      setNotes,
      setQuery,
      setSelectedNoteId,
      setSidebarView,
      setStatusMessage,
      updateActiveTransformSession
    });
  }

  function openFindBar() {
    openFindBarFromHook();
  }

  function closeFindBar(options?: { restoreEditorFocus?: boolean }) {
    closeFindBarFromHook(options);
  }

  function searchFind(direction: 1 | -1) {
    searchFindFromHook(direction);
  }

  function openAiPromptComposer() {
    if (!canOpenAiPromptComposer()) return;
    resetBeforeAiPromptComposer();
    setStatusMessage("AI 정리 입력창을 열어두었어요.");
  }

  function canOpenAiPromptComposer() {
    if (isMutationLocked) return blockAiPrompt("저장소 연결이 복구될 때까지 AI 정리를 실행할 수 없어요.");
    if (isStickyMode) return blockAiPrompt("스티커 메모에서는 AI 정리 미리보기를 열 수 없어요. 일반 모드에서 실행해 주세요.");
    return Boolean(activeNote);
  }

  function blockAiPrompt(message: string) {
    setStatusMessage(message);
    return false;
  }

  function resetBeforeAiPromptComposer() {
    setDeleteIntentId(null);
    setNoteMenuId(null);
    closeFindBar();
    closeComposeSession();
    closeContextSearchPanel();
    if (!activeNote) return;
    openTransformSession(activeNote.id, activeTransformSession?.prompt || activeDraft?.prompt || "");
  }

  function closeAiPromptComposer() {
    closeActiveTransformSession({ clearDraft: true, clearPrompt: true, clearFeedback: true });
    setActiveSidebarSurface("notes");
    setStatusMessage("AI 정리 입력창을 닫았어요.");
  }

  const { appShellClassName, appBodyClassName, appBodyGridStyle } = useAppShellLayout({
    chatWidth,
    isAiChatOpen,
    isChatExpanded,
    isMacOS,
    isSidebarOpen,
    isStickyMode,
    sidebarWidth
  });

  const paperStatusLabel = isMutationLocked
    ? "읽기 전용"
    : isTransformPreviewGenerating
      ? "AI 생성 중"
    : activeDraft
      ? "미리보기 전용"
      : "로컬 저장 완료";
  const showPaperStatus = isMutationLocked || isTransformPreviewGenerating || Boolean(activeDraft);
  const sidebarCountLabel = hasQuery
    ? `결과 ${filteredNotes.length}개`
    : categoryFilter !== "all"
      ? `메모 ${scopedNotes.length}개`
    : sidebarView === "favorites"
      ? `즐겨찾기 ${scopedNotes.length}개`
      : `메모 ${notes.length}개`;
  return (
    <main className="page" data-testid="page-root">
      <section className={appShellClassName} data-testid="app-shell">
        <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="status-live-region">
          {statusMessage}
        </div>
        <section className={appBodyClassName} style={appBodyGridStyle}>
          <Sidebar
            activeNote={activeNote}
            activeSidebarSurface={activeSidebarSurface}
            categories={visibleCategories}
            categoryCounts={categoryCounts}
            categoryFilter={categoryFilter}
            contextSearch={contextSearch}
            createCategory={createCategory}
            deleteCategory={deleteCategory}
            deleteUnusedCategories={deleteUnusedCategories}
            updateCategory={updateCategory}
            filteredNotes={filteredNotes}
            hasQuery={hasQuery}
            isAiChatOpen={isAiChatOpen}
            isCategorizingAll={isCategorizingAll}
            isCollectionEmpty={isCollectionEmpty}
            isComposeScreenOpen={isComposeScreenOpen}
            isMutationLocked={isMutationLocked}
            isStickyMode={isStickyMode}
            noteMenuId={noteMenuId}
            query={query}
            searchInputRef={searchInputRef}
            shouldShowStorageNotice={shouldShowStorageNotice}
            sidebarCountLabel={sidebarCountLabel}
            sidebarView={sidebarView}
            storageBadgeClassName={storageBadgeClassName}
            storageBadgeLabel={storageBadgeLabel}
            storageHealthReady={storageHealth?.ready}
            storageStatusSummary={storageStatusSummary}
            beginDeleteNote={beginDeleteNote}
            closeContextSearchPanel={closeContextSearchPanel}
            handleCreateNote={handleCreateNote}
            handleSearch={handleSearch}
            openNoteFromContextSearch={openNoteFromContextSearch}
            runCategorizeAllUncategorized={runCategorizeAllUncategorized}
            runContextSearch={runContextSearch}
            setCategoryFilter={setCategoryFilter}
            setDeleteIntentId={setDeleteIntentId}
            setNoteMenuId={setNoteMenuId}
            setSelectedNoteId={setSelectedNoteId}
            switchSidebarView={switchSidebarView}
            toggleAiChatPanel={toggleAiChatPanel}
            toggleNoteMenu={toggleNoteMenu}
          />

          {isSidebarOpen && !isStickyMode ? (
            <div
              className="panel-resize-handle panel-resize-handle--sidebar"
              aria-hidden="true"
              onMouseDown={startSidebarResize}
            />
          ) : null}

          <section className={`editor-pane${isChatExpanded && isAiChatOpen && !isStickyMode ? " editor-pane--hidden" : ""}`}>
            {isStickyMode ? (
              <StickyNotePane
                activeNote={activeNote}
                hasBackup={hasBackup}
                isDedicatedStickyWindow={isDedicatedStickyWindow}
                isEditorLocked={isEditorLocked}
                isMutationLocked={isMutationLocked}
                isStickyPinned={isStickyPinned}
                noteBodyInputRef={noteBodyInputRef}
                closeStickySurface={closeStickySurface}
                handleCreateStickyNoteWindow={handleCreateStickyNoteWindow}
                patchActiveNote={patchActiveNote}
                toggleStickyPinned={toggleStickyPinned}
              />
            ) : isComposeScreenOpen ? (
              <ComposeWorkspace
                composePromptInputRef={composePromptInputRef}
                composeSession={composeSession}
                isComposeAnimating={isComposeAnimating}
                isComposeBusy={isComposeBusy}
                isComposeGenerating={isComposeGenerating}
                notesCount={notes.length}
                closeComposeSession={closeComposeSession}
                setComposeSession={setComposeSession}
                startComposeDraft={startComposeDraft}
              />
            ) : (
              <EditorWorkspace
                activeAiPrompt={activeAiPrompt}
                activeDraft={activeDraft}
                activeNote={activeNote}
                activeTransformFeedback={activeTransformFeedback}
                aiPromptInputRef={aiPromptInputRef}
                categorizingNoteIds={categorizingNoteIds}
                categories={visibleCategories}
                categoryFilter={categoryFilter}
                emptyCreateButtonRef={emptyCreateButtonRef}
                committedFindQuery={committedFindQuery}
                findInputRef={findInputRef}
                findMatches={findMatches}
                findMatchIndex={findMatchIndex}
                findQuery={findQuery}
                hasBackup={hasBackup}
                hasQuery={hasQuery}
                isActiveNoteBusy={isActiveNoteBusy}
                isAiPromptOpen={isAiPromptOpen}
                isAnyTransformGenerating={isAnyTransformGenerating}
                isCollectionEmpty={isCollectionEmpty}
                isEditorLocked={isEditorLocked}
                isFindBarOpen={isFindBarOpen}
                isMutationLocked={isMutationLocked}
                isPreviewActionCoolingDown={isPreviewActionCoolingDown}
                isSidebarOpen={isSidebarOpen}
                isStickyMode={isStickyMode}
                isTransformPreviewGenerating={isTransformPreviewGenerating}
                noteBodyInputRef={noteBodyInputRef}
                paperStatusLabel={paperStatusLabel}
                previewDiffSegments={previewDiffSegments}
                promptTemplateEditor={promptTemplateEditor}
                promptTemplates={promptTemplates}
                showPaperStatus={showPaperStatus}
                showStorageLock={isMutationLocked && Boolean(storageHealth)}
                sidebarView={sidebarView}
                storageLockMessage={storageHealth?.errorMessage ?? "저장소 연결 확인이 끝날 때까지 편집을 잠가두었어요."}
                applyPromptTemplate={applyPromptTemplate}
                applyTransformDraft={applyTransformDraft}
                cancelTransformPreview={cancelTransformPreview}
                closeAiPromptComposer={closeAiPromptComposer}
                closeFindBar={closeFindBar}
                closePromptTemplateEditor={closePromptTemplateEditor}
                handleCreateNote={handleCreateNote}
                handleOpenStickyNoteWindow={handleOpenStickyNoteWindow}
                openAiPromptComposer={openAiPromptComposer}
                openFindBar={openFindBar}
                openPromptTemplateEditor={openPromptTemplateEditor}
                openSidebar={() => setIsSidebarOpen(true)}
                patchActiveNote={patchActiveNote}
                persistPromptTemplate={persistPromptTemplate}
                removePromptTemplate={removePromptTemplate}
                restoreOriginal={restoreOriginal}
                runAiCategorize={runAiCategorize}
                searchFind={searchFind}
                setFindQuery={setFindQuery}
                setNoteCategory={setNoteCategory}
                setPromptTemplateEditor={setPromptTemplateEditor}
                startTransformPreview={startTransformPreview}
                toggleFavorite={toggleFavorite}
                toggleSidebar={() => setIsSidebarOpen((current) => !current)}
                updateActiveTransformSession={updateActiveTransformSession}
              />
            )}
          </section>

          {!isStickyMode && isAiChatOpen && !isChatExpanded ? (
            <div
              className="panel-resize-handle panel-resize-handle--chat"
              aria-hidden="true"
              onMouseDown={startChatResize}
            />
          ) : null}

          {!isStickyMode && isAiChatOpen ? (
            <AiChatPanel
              activeNote={activeNote}
              aiChatInput={aiChatInput}
              aiChatInputRef={aiChatInputRef}
              aiChatMessages={aiChatMessages}
              aiChatMode={aiChatMode}
              aiChatThreadRef={aiChatThreadRef}
              isAiChatThinking={isAiChatThinking}
              cancelAiChatRequest={cancelAiChatRequest}
              closeAiChatPanel={closeAiChatPanel}
              openNoteFromAiChat={openNoteFromAiChat}
              setAiChatInput={setAiChatInput}
              setAiChatMode={setAiChatMode}
              submitAiChatPrompt={submitAiChatPrompt}
            />
          ) : null}
        </section>
        {isDeleteModalOpen && deleteTargetNote ? (
          <DeleteConfirmModal
            deleteTargetHeadline={deleteTargetHeadline}
            isMutationLocked={isMutationLocked}
            cancelDeleteNote={cancelDeleteNote}
            confirmDeleteNote={confirmDeleteNote}
          />
        ) : null}
      </section>
    </main>
  );
}

export default App;
