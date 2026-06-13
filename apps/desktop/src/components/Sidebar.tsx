import { useState } from "react";
import type { Dispatch, FormEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import type { MemoCategory, MemoCategoryDefinition, MemoId } from "@ai-note/shared/memo";
import { deriveNoteHeadline } from "../note-content";
import { IconBolt, IconChat, IconCheck, IconChevron, IconClose, IconPlus } from "./icons";
import { canOpenQuickCaptureWindow, isMacOSPlatform, openQuickCaptureWindow } from "../infrastructure/desktop-window";
import { getCategoryDisplayLabel } from "../domain/categories";
import type { Note } from "../domain/note";
import type { CategoryFilter } from "../hooks/useMemoCategoryController";
import type { ContextSearchState, SidebarSurface, SidebarView } from "../domain/workspace";

type SidebarProps = {
  activeNote: Note | null;
  activeSidebarSurface: SidebarSurface;
  categories: MemoCategoryDefinition[];
  categoryCounts: Record<MemoCategory, number>;
  categoryFilter: CategoryFilter;
  contextSearch: ContextSearchState;
  filteredNotes: Note[];
  hasQuery: boolean;
  isAiChatOpen: boolean;
  isCollectionEmpty: boolean;
  isComposeScreenOpen: boolean;
  isMutationLocked: boolean;
  isStickyMode: boolean;
  noteMenuId: MemoId | null;
  query: string;
  searchInputRef: RefObject<HTMLInputElement>;
  shouldShowStorageNotice: boolean;
  sidebarCountLabel: string;
  sidebarView: SidebarView;
  storageBadgeClassName: string;
  storageBadgeLabel: string;
  storageHealthReady: boolean | undefined;
  storageStatusSummary: string;
  beginDeleteNote: (noteId?: MemoId) => void;
  closeContextSearchPanel: () => void;
  createCategory: (label: string) => Promise<MemoCategoryDefinition | null>;
  handleCreateNote: () => Promise<void>;
  handleSearch: (nextQuery: string) => void;
  openNoteFromContextSearch: (noteId: MemoId) => void;
  runContextSearch: () => Promise<void>;
  setCategoryFilter: Dispatch<SetStateAction<CategoryFilter>>;
  setDeleteIntentId: Dispatch<SetStateAction<MemoId | null>>;
  setNoteMenuId: Dispatch<SetStateAction<MemoId | null>>;
  setSelectedNoteId: Dispatch<SetStateAction<MemoId | "">>;
  switchSidebarView: (nextView: SidebarView) => void;
  toggleAiChatPanel: () => void;
  toggleNoteMenu: (noteId: MemoId) => void;
};

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sidebar" id="memo-sidebar">
      <SidebarHead {...props} />
      <SidebarSurface {...props} />
      <SidebarStorageNotice {...props} />
    </aside>
  );
}

function SidebarHead(props: SidebarProps) {
  const [isCategoryAccordionOpen, setIsCategoryAccordionOpen] = useState(false);

  return (
    <div className="sidebar-head" data-testid="app-brand-mark">
      <SidebarActions {...props} />
      <SidebarSearch {...props} />
      <SidebarNav {...props} isCategoryAccordionOpen={isCategoryAccordionOpen} setIsCategoryAccordionOpen={setIsCategoryAccordionOpen} />
      <SidebarCategoryAccordion {...props} isCategoryAccordionOpen={isCategoryAccordionOpen} setIsCategoryAccordionOpen={setIsCategoryAccordionOpen} />
    </div>
  );
}

function SidebarActions({ isAiChatOpen, isMutationLocked, isStickyMode, toggleAiChatPanel }: SidebarProps) {
  if (isStickyMode) {
    return null;
  }

  return (
    <div className="sidebar-actions-row">
      <QuickCaptureButton />
      <AiChatToggleButton isAiChatOpen={isAiChatOpen} isMutationLocked={isMutationLocked} toggleAiChatPanel={toggleAiChatPanel} />
    </div>
  );
}

function QuickCaptureButton() {
  if (!canOpenQuickCaptureWindow()) {
    return null;
  }

  const shortcutLabel = isMacOSPlatform() ? "⌘⇧N" : "Ctrl+Shift+N";
  const label = `빠른 메모 (전역 단축키 ${shortcutLabel})`;

  return (
    <button className="sidebar-ai-chat-button sidebar-ai-chat-button--icon" type="button" data-testid="sidebar-quick-capture-button" aria-label={label} title={label} onClick={() => void openQuickCaptureWindow()}>
      <IconBolt className="button-icon" />
      <span className="visually-hidden">빠른 메모</span>
    </button>
  );
}

function AiChatToggleButton({ isAiChatOpen, isMutationLocked, toggleAiChatPanel }: Pick<SidebarProps, "isAiChatOpen" | "isMutationLocked" | "toggleAiChatPanel">) {
  return (
    <button className={`sidebar-ai-chat-button sidebar-ai-chat-button--icon${isAiChatOpen ? " is-active" : ""}`} type="button" data-testid="sidebar-ai-chat-button" aria-label={isAiChatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"} title={isAiChatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"} aria-pressed={isAiChatOpen} disabled={isMutationLocked && !isAiChatOpen} onClick={toggleAiChatPanel}>
      <IconChat className="button-icon" />
      <span className="visually-hidden">{isAiChatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}</span>
    </button>
  );
}

function SidebarSearch({ handleSearch, query, searchInputRef }: SidebarProps) {
  return (
    <label className="sidebar-search">
      <span className="visually-hidden">키워드 검색</span>
      <input ref={searchInputRef} type="text" placeholder="키워드 검색" data-testid="note-search-input" autoComplete="off" spellCheck={false} value={query} onChange={(event) => handleSearch(event.target.value)} onKeyDown={(event) => closeSearchOnEscape(event, searchInputRef)} />
    </label>
  );
}

function closeSearchOnEscape(event: KeyboardEvent<HTMLInputElement>, searchInputRef: RefObject<HTMLInputElement>) {
  if (event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  searchInputRef.current?.blur();
}

function SidebarNav({
  categoryFilter,
  isCategoryAccordionOpen,
  isComposeScreenOpen,
  setCategoryFilter,
  setIsCategoryAccordionOpen,
  sidebarView,
  switchSidebarView
}: SidebarProps & CategoryAccordionState) {
  return (
    <nav className="sidebar-nav" aria-label="사이드바 탐색">
      <SidebarNavButton active={sidebarView === "all" && categoryFilter === "all"} disabled={isComposeScreenOpen} testId="sidebar-all-view-button" onClick={() => selectPrimaryView("all", { setCategoryFilter, setIsCategoryAccordionOpen, switchSidebarView })}>
        <span>전체 메모</span>
      </SidebarNavButton>
      <SidebarNavButton active={sidebarView === "favorites" && categoryFilter === "all"} disabled={isComposeScreenOpen} testId="sidebar-favorites-view-button" onClick={() => selectPrimaryView("favorites", { setCategoryFilter, setIsCategoryAccordionOpen, switchSidebarView })}>
        <span>즐겨찾기</span>
      </SidebarNavButton>
      <SidebarNavButton active={categoryFilter !== "all" || isCategoryAccordionOpen} disabled={isComposeScreenOpen} testId="sidebar-category-view-button" ariaControls="sidebar-category-accordion" ariaExpanded={isCategoryAccordionOpen} onClick={() => toggleCategoryAccordion({ setIsCategoryAccordionOpen, sidebarView, switchSidebarView })}>
        <span className="sidebar-nav-item__content">
          <span>카테고리</span>
          <IconChevron className="sidebar-nav-item__chevron" open={isCategoryAccordionOpen} />
        </span>
      </SidebarNavButton>
    </nav>
  );
}

function SidebarNavButton({ active, ariaControls, ariaExpanded, children, disabled, onClick, testId }: { active: boolean; ariaControls?: string; ariaExpanded?: boolean; children: ReactNode; disabled: boolean; onClick: () => void; testId: string }) {
  return (
    <button className={`sidebar-nav-item${active ? " is-active" : ""}`} type="button" data-testid={testId} disabled={disabled} aria-controls={ariaControls} aria-expanded={ariaExpanded} onClick={onClick}>
      {children}
    </button>
  );
}

type CategoryAccordionState = {
  isCategoryAccordionOpen: boolean;
  setIsCategoryAccordionOpen: Dispatch<SetStateAction<boolean>>;
};

function selectPrimaryView(nextView: SidebarView, { setCategoryFilter, setIsCategoryAccordionOpen, switchSidebarView }: Pick<SidebarProps, "setCategoryFilter" | "switchSidebarView"> & Pick<CategoryAccordionState, "setIsCategoryAccordionOpen">) {
  setCategoryFilter("all");
  setIsCategoryAccordionOpen(false);
  switchSidebarView(nextView);
}

function toggleCategoryAccordion({ setIsCategoryAccordionOpen, sidebarView, switchSidebarView }: Pick<SidebarProps, "sidebarView" | "switchSidebarView"> & Pick<CategoryAccordionState, "setIsCategoryAccordionOpen">) {
  if (sidebarView !== "all") {
    switchSidebarView("all");
  }

  setIsCategoryAccordionOpen((current) => !current);
}

function SidebarCategoryAccordion(props: SidebarProps & CategoryAccordionState) {
  return (
    <div id="sidebar-category-accordion" className={`sidebar-category-accordion${props.isCategoryAccordionOpen ? " is-open" : ""}`} role="region" aria-label="카테고리 필터" aria-hidden={!props.isCategoryAccordionOpen}>
      <div className="sidebar-category-accordion__inner">
        {props.isCategoryAccordionOpen ? <SidebarCategoryFilter {...props} /> : null}
      </div>
    </div>
  );
}

function SidebarCategoryFilter({ categories, categoryCounts, categoryFilter, createCategory, isComposeScreenOpen, isMutationLocked, setCategoryFilter }: SidebarProps) {
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [draftCategoryName, setDraftCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSavingCategory) {
      return;
    }

    setIsSavingCategory(true);
    const createdCategory = await createCategory(draftCategoryName);
    setIsSavingCategory(false);

    if (!createdCategory) {
      return;
    }

    setDraftCategoryName("");
    setIsAddingCategory(false);
  }

  return (
    <div className="sidebar-category-filter" role="group" aria-label="카테고리 선택">
      <div className="sidebar-category-filter__actions">
        <button className="category-add-button" type="button" data-testid="category-add-button" aria-label="카테고리 추가" title="카테고리 추가" disabled={isComposeScreenOpen || isMutationLocked || isSavingCategory} onClick={() => setIsAddingCategory(true)}>
          <IconPlus className="category-add-button__icon" />
        </button>
      </div>
      {isAddingCategory ? (
        <form className="category-create-form" data-testid="category-create-form" onSubmit={submitCategory}>
          <input className="category-create-form__input" data-testid="category-create-input" type="text" value={draftCategoryName} maxLength={32} autoFocus placeholder="카테고리 이름" disabled={isSavingCategory} onChange={(event) => setDraftCategoryName(event.target.value)} onKeyDown={(event) => closeCategoryCreateFormOnEscape(event, { setDraftCategoryName, setIsAddingCategory })} />
          <button className="category-create-form__button" type="submit" data-testid="category-create-submit-button" aria-label="저장" title="저장" disabled={isSavingCategory || draftCategoryName.trim().length === 0}>
            <IconCheck className="category-create-form__icon" />
          </button>
          <button className="category-create-form__button" type="button" aria-label="취소" title="취소" disabled={isSavingCategory} onClick={() => cancelCategoryCreate({ setDraftCategoryName, setIsAddingCategory })}>
            <IconClose className="category-create-form__icon" />
          </button>
        </form>
      ) : null}
      {categories.map((category) => (
        <CategoryAccordionItem key={category.id} active={categoryFilter === category.id} category={category} count={categoryCounts[category.id] ?? 0} disabled={isComposeScreenOpen} onClick={() => selectCategoryFilter(category.id, { setCategoryFilter })} />
      ))}
    </div>
  );
}

function closeCategoryCreateFormOnEscape(event: KeyboardEvent<HTMLInputElement>, params: Pick<CategoryCreateFormActions, "setDraftCategoryName" | "setIsAddingCategory">) {
  if (event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  cancelCategoryCreate(params);
}

type CategoryCreateFormActions = {
  setDraftCategoryName: Dispatch<SetStateAction<string>>;
  setIsAddingCategory: Dispatch<SetStateAction<boolean>>;
};

function cancelCategoryCreate({ setDraftCategoryName, setIsAddingCategory }: CategoryCreateFormActions) {
  setDraftCategoryName("");
  setIsAddingCategory(false);
}

function selectCategoryFilter(category: MemoCategory, { setCategoryFilter }: Pick<SidebarProps, "setCategoryFilter">) {
  setCategoryFilter(category);
}

function CategoryAccordionItem({ active, category, count, disabled, onClick }: { active: boolean; category: MemoCategoryDefinition; count: number; disabled: boolean; onClick: () => void }) {
  const panelId = `category-filter-panel-${category.id}`;

  return (
    <div className={`category-accordion-item${active ? " is-active" : ""}`}>
      <button className="category-filter-chip" type="button" data-testid={`category-filter-${category.id}`} disabled={disabled} aria-expanded={active} aria-controls={panelId} aria-pressed={active} onClick={onClick}>
        <span className="category-filter-chip__label">{category.label}</span>
        <span className="category-filter-chip__meta">
          <span className="category-filter-chip__count">{count}</span>
          <IconChevron className="category-filter-chip__chevron" open={active} />
        </span>
      </button>
      {active ? (
        <div className="category-filter-panel" id={panelId}>
          <span>메모 {count}개</span>
        </div>
      ) : null}
    </div>
  );
}

function SidebarSurface(props: SidebarProps) {
  if (props.activeSidebarSurface === "ai-context") {
    return <ContextSearchPanel {...props} />;
  }

  return <NotesSurface {...props} />;
}

function ContextSearchPanel({ activeNote, closeContextSearchPanel, contextSearch, openNoteFromContextSearch, runContextSearch }: SidebarProps) {
  return (
    <section className="sidebar-surface sidebar-context-search" data-testid="context-search-panel">
      <ContextSearchHeader contextSearch={contextSearch} runContextSearch={runContextSearch} closeContextSearchPanel={closeContextSearchPanel} />
      <ContextSearchBody activeNote={activeNote} contextSearch={contextSearch} openNoteFromContextSearch={openNoteFromContextSearch} />
    </section>
  );
}

function ContextSearchHeader({ closeContextSearchPanel, contextSearch, runContextSearch }: Pick<SidebarProps, "closeContextSearchPanel" | "contextSearch" | "runContextSearch">) {
  return (
    <div className="sidebar-surface__header">
      <div className="sidebar-surface__title-block">
        <strong>AI 검색</strong>
        <span>질문처럼 적으면 관련 메모와 이유를 함께 보여줍니다.</span>
      </div>
      <div className="sidebar-surface__actions">
        <button className={`paper-button paper-button-primary${contextSearch.isLoading ? " is-loading" : ""}`} type="button" data-testid="submit-context-search-button" disabled={contextSearch.isLoading || contextSearch.query.trim().length === 0} onClick={() => void runContextSearch()}>
          실행
        </button>
        <button className="paper-button" type="button" onClick={closeContextSearchPanel}>
          닫기
        </button>
      </div>
    </div>
  );
}

function ContextSearchBody({ activeNote, contextSearch, openNoteFromContextSearch }: Pick<SidebarProps, "activeNote" | "contextSearch" | "openNoteFromContextSearch">) {
  if (contextSearch.results.length > 0) {
    return <ContextSearchResults activeNote={activeNote} contextSearch={contextSearch} openNoteFromContextSearch={openNoteFromContextSearch} />;
  }

  if (contextSearch.isLoading) {
    return <SidebarEmpty testId="context-search-loading-state" className="context-search-loading" title="관련 메모를 찾고 있어요" text="찾은 뒤에는 선택 이유와 미리보기를 함께 보여드립니다." badge="검색 중..." />;
  }

  if (contextSearch.hasSearched) {
    return <SidebarEmpty testId="context-search-empty-state" title="관련 메모를 찾지 못했어요" text="다른 표현이나 더 구체적인 맥락으로 다시 검색해 보세요." />;
  }

  return <SidebarEmpty testId="context-search-hint" title="자연어로 관련 메모를 찾습니다" text="결과에는 메모 미리보기와 선택 이유를 함께 표시합니다." />;
}

function ContextSearchResults({ activeNote, contextSearch, openNoteFromContextSearch }: Pick<SidebarProps, "activeNote" | "contextSearch" | "openNoteFromContextSearch">) {
  return (
    <ul className="note-list" data-testid="context-search-results">
      {contextSearch.results.map((result) => (
        <li key={result.memo.id} className={`note-list-item is-context-result${activeNote?.id === result.memo.id ? " is-selected" : ""}`}>
          <button className="note-list-item-button" type="button" data-testid={`open-context-search-result-${result.memo.id}`} onClick={() => openNoteFromContextSearch(result.memo.id)}>
            <span className="note-list-copy">
              <strong>{deriveNoteHeadline(result.memo.body)}</strong>
              <span className="note-list-date">{result.memo.updatedAt}</span>
              <span className="note-list-preview">{result.preview || result.reason}</span>
              <span className="context-search-result-reason">{result.reason}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NotesSurface(props: SidebarProps) {
  return (
    <>
      <SidebarSectionHeading {...props} />
      <NotesListOrEmpty {...props} />
    </>
  );
}

function SidebarSectionHeading(props: SidebarProps) {
  const sectionTitle = getSidebarSectionTitle(props);

  return (
    <div className="sidebar-section-heading">
      <span className="sidebar-section-heading__label">
        <span>{sectionTitle}</span>
        <span className="sidebar-section-heading__count">{props.sidebarCountLabel}</span>
      </span>
      <SidebarCreateButton {...props} />
    </div>
  );
}

function SidebarCreateButton({ handleCreateNote, isComposeScreenOpen, isMutationLocked }: SidebarProps) {
  return (
    <button className="paper-button paper-button-icon sidebar-create-button" type="button" data-testid="sidebar-create-note-button" aria-label="새 메모 만들기" title="새 메모 만들기" disabled={isMutationLocked || isComposeScreenOpen} onClick={() => void handleCreateNote()}>
      <IconPlus className="button-icon" />
      <span className="visually-hidden">새 메모 만들기</span>
    </button>
  );
}

function NotesListOrEmpty(props: SidebarProps) {
  if (!props.isCollectionEmpty && props.filteredNotes.length > 0) {
    return <NotesList {...props} />;
  }

  return <NotesEmptyState {...props} />;
}

function NotesList(props: SidebarProps) {
  return (
    <ul className="note-list" aria-label="메모 목록" data-testid="note-list">
      {props.filteredNotes.map((note) => <NoteListItem key={note.id} note={note} {...props} />)}
    </ul>
  );
}

function NoteListItem(props: SidebarProps & { note: Note }) {
  const isSelected = props.activeNote?.id === props.note.id;
  const noteLabel = deriveNoteHeadline(props.note.body);
  const isNoteMenuOpen = props.noteMenuId === props.note.id;
  const noteMenuIdValue = `note-actions-menu-${props.note.id}`;

  return (
    <li className={`note-list-item${isSelected ? " is-selected" : ""}`} data-mode={props.note.mode} onClick={() => selectNote(props.note.id, props)} onContextMenu={(event) => openNoteContextMenu(event, props.note.id, props)}>
      <button className="note-list-item-button" data-testid={`note-list-item-${props.note.id}`} type="button" disabled={props.isComposeScreenOpen} aria-current={isSelected ? "true" : undefined} aria-label={`${noteLabel} 메모`} aria-expanded={isNoteMenuOpen} aria-controls={isNoteMenuOpen ? noteMenuIdValue : undefined} onClick={() => selectNote(props.note.id, props)}>
        <span className="note-list-copy">
          <strong>{noteLabel}</strong>
          <span className="note-list-meta">
            <span className="note-list-date">{props.note.dateLabel === "이제" ? props.note.updatedAt : props.note.dateLabel}</span>
            {props.note.category ? <span className="note-category-badge">{getCategoryDisplayLabel(props.categories, props.note.category)}</span> : null}
          </span>
        </span>
      </button>
      {isNoteMenuOpen ? <NoteMenu noteId={props.note.id} noteMenuIdValue={noteMenuIdValue} {...props} /> : null}
    </li>
  );
}

function openNoteContextMenu(event: MouseEvent<HTMLLIElement>, noteId: MemoId, props: SidebarProps) {
  if (props.isComposeScreenOpen) {
    return;
  }

  event.preventDefault();
  props.toggleNoteMenu(noteId);
}

function selectNote(noteId: MemoId, { isComposeScreenOpen, setDeleteIntentId, setNoteMenuId, setSelectedNoteId }: SidebarProps) {
  if (isComposeScreenOpen) {
    return;
  }

  setSelectedNoteId(noteId);
  setDeleteIntentId(null);
  setNoteMenuId(null);
}

function NoteMenu(props: SidebarProps & { noteId: MemoId; noteMenuIdValue: string }) {
  return (
    <div className="note-list-menu" id={props.noteMenuIdValue} data-note-menu-root="true" onClick={(event) => event.stopPropagation()}>
      <button className="note-list-menu-item note-list-menu-item-danger" type="button" data-testid="selected-note-delete-button" disabled={props.isMutationLocked} onClick={() => props.beginDeleteNote(props.noteId)}>
        삭제
      </button>
    </div>
  );
}

function NotesEmptyState(props: SidebarProps) {
  return (
    <section className="note-list sidebar-empty" data-testid="sidebar-empty-state">
      <strong>{getSidebarEmptyTitle(props)}</strong>
      <p>{getSidebarEmptyText(props)}</p>
      {props.shouldShowStorageNotice && props.storageStatusSummary ? <StorageSummary {...props} /> : null}
    </section>
  );
}

function getSidebarSectionTitle(props: SidebarProps) {
  const { categories, categoryFilter, sidebarView } = props;

  if (categoryFilter !== "all") return getCategoryDisplayLabel(categories, categoryFilter);
  return sidebarView === "favorites" ? "즐겨찾기" : "최근";
}

function getSidebarEmptyTitle(props: SidebarProps) {
  const { categories, categoryFilter, hasQuery, isCollectionEmpty, sidebarView } = props;

  if (isCollectionEmpty) return "메모가 없어요";
  if (categoryFilter !== "all" && !hasQuery) return `${getCategoryDisplayLabel(categories, categoryFilter)} 메모가 없어요`;
  if (sidebarView === "favorites" && !hasQuery) return "즐겨찾기가 없어요";
  return "검색 결과가 없어요";
}

function getSidebarEmptyText({ categoryFilter, hasQuery, isCollectionEmpty, sidebarView }: SidebarProps) {
  if (isCollectionEmpty) return "새 메모를 만들면 바로 목록에 나타나요.";
  if (categoryFilter !== "all" && !hasQuery) return "해당 카테고리로 분류된 메모가 아직 없어요.";
  if (sidebarView === "favorites" && !hasQuery) return "메모 오른쪽 위 별 버튼을 누르면 즐겨찾기 목록에 모아볼 수 있어요.";
  return "다른 검색어를 입력하거나 검색을 해제해 주세요.";
}

function StorageSummary({ storageHealthReady, storageStatusSummary }: SidebarProps) {
  return (
    <p className={`sidebar-empty-status${storageHealthReady ? "" : " is-warning"}`} data-testid="sidebar-storage-summary">
      {storageStatusSummary}
    </p>
  );
}

function SidebarStorageNotice({ shouldShowStorageNotice, storageBadgeClassName, storageBadgeLabel, storageStatusSummary }: SidebarProps) {
  if (!shouldShowStorageNotice) {
    return null;
  }

  return (
    <footer className="sidebar-foot" data-testid="storage-notice">
      <span className={`${storageBadgeClassName} sidebar-foot-badge`} data-testid="storage-status-badge">
        {storageBadgeLabel}
      </span>
      {storageStatusSummary ? <p>{storageStatusSummary}</p> : <p>모든 메모는 로컬 저장소에 바로 반영돼요.</p>}
    </footer>
  );
}

function SidebarEmpty({ badge, className = "", testId, text, title }: { badge?: string; className?: string; testId: string; text: string; title: string }) {
  return (
    <section className={`note-list sidebar-empty${className ? ` ${className}` : ""}`} data-testid={testId}>
      {badge ? <span className="context-search-loading__badge">{badge}</span> : null}
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}
