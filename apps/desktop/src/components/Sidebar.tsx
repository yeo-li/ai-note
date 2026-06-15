import { useState } from "react";
import { createPortal } from "react-dom";
import type { Dispatch, FormEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import type { MemoCategory, MemoCategoryDefinition, MemoCategoryUpdateInput, MemoId } from "@ai-note/shared/memo";
import { deriveNoteHeadline } from "../note-content";
import { IconBolt, IconChat, IconCheck, IconChevron, IconClose, IconFolder, IconPlus, IconSparkles } from "./icons";
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
  isCategorizingAll: boolean;
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
  deleteCategory: (categoryId: MemoCategory) => Promise<boolean>;
  updateCategory: (categoryId: MemoCategory, patch: MemoCategoryUpdateInput) => Promise<MemoCategoryDefinition | null>;
  handleCreateNote: () => Promise<void>;
  handleSearch: (nextQuery: string) => void;
  openNoteFromContextSearch: (noteId: MemoId) => void;
  runCategorizeAllUncategorized: () => Promise<void>;
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
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  return (
    <div className="sidebar-head" data-testid="app-brand-mark">
      <SidebarActions {...props} />
      <SidebarSearch {...props} />
      <SidebarNav {...props} isCategoryDropdownOpen={isCategoryDropdownOpen} setIsCategoryDropdownOpen={setIsCategoryDropdownOpen} />
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

function SidebarNav(props: SidebarProps & CategoryDropdownState) {
  const { categories, categoryFilter, isCategoryDropdownOpen, isComposeScreenOpen, setCategoryFilter, setIsCategoryDropdownOpen, sidebarView, switchSidebarView } = props;
  const categoryLabel = categoryFilter !== "all" ? getCategoryDisplayLabel(categories, categoryFilter) : "카테고리";

  return (
    <nav className="sidebar-nav" aria-label="사이드바 탐색">
      <SidebarNavButton active={sidebarView === "all" && categoryFilter === "all"} disabled={isComposeScreenOpen} testId="sidebar-all-view-button" onClick={() => selectPrimaryView("all", { setCategoryFilter, setIsCategoryDropdownOpen, switchSidebarView })}>
        <span>전체 메모</span>
      </SidebarNavButton>
      <SidebarNavButton active={sidebarView === "favorites" && categoryFilter === "all"} disabled={isComposeScreenOpen} testId="sidebar-favorites-view-button" onClick={() => selectPrimaryView("favorites", { setCategoryFilter, setIsCategoryDropdownOpen, switchSidebarView })}>
        <span>즐겨찾기</span>
      </SidebarNavButton>
      <SidebarNavButton active={categoryFilter !== "all" || isCategoryDropdownOpen} disabled={isComposeScreenOpen} testId="sidebar-category-view-button" ariaControls="sidebar-category-dropdown-panel" ariaExpanded={isCategoryDropdownOpen} onClick={() => toggleCategoryDropdown({ setIsCategoryDropdownOpen, sidebarView, switchSidebarView })}>
        <span className="sidebar-nav-item__content">
          <span className="sidebar-nav-item__label">{categoryLabel}</span>
          <IconChevron className="sidebar-nav-item__chevron" open={isCategoryDropdownOpen} />
        </span>
      </SidebarNavButton>
      {isCategoryDropdownOpen ? (
        <>
          <div className="category-dropdown-backdrop" onClick={() => setIsCategoryDropdownOpen(false)} />
          <CategoryDropdownPanel {...props} closeDropdown={() => setIsCategoryDropdownOpen(false)} />
        </>
      ) : null}
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

type CategoryDropdownState = {
  isCategoryDropdownOpen: boolean;
  setIsCategoryDropdownOpen: Dispatch<SetStateAction<boolean>>;
};

function selectPrimaryView(nextView: SidebarView, { setCategoryFilter, setIsCategoryDropdownOpen, switchSidebarView }: Pick<SidebarProps, "setCategoryFilter" | "switchSidebarView"> & Pick<CategoryDropdownState, "setIsCategoryDropdownOpen">) {
  setCategoryFilter("all");
  setIsCategoryDropdownOpen(false);
  switchSidebarView(nextView);
}

function toggleCategoryDropdown({ setIsCategoryDropdownOpen, sidebarView, switchSidebarView }: Pick<SidebarProps, "sidebarView" | "switchSidebarView"> & Pick<CategoryDropdownState, "setIsCategoryDropdownOpen">) {
  if (sidebarView !== "all") {
    switchSidebarView("all");
  }

  setIsCategoryDropdownOpen((current) => !current);
}

function CategoryDropdownPanel(props: SidebarProps & { closeDropdown: () => void }) {
  const { categories, categoryCounts, categoryFilter, closeDropdown, createCategory, deleteCategory, isCategorizingAll, isComposeScreenOpen, isMutationLocked, runCategorizeAllUncategorized, setCategoryFilter, updateCategory } = props;
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [draftCategoryName, setDraftCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MemoCategoryDefinition | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<MemoCategoryDefinition | null>(null);

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
    <div className="category-dropdown-panel" id="sidebar-category-dropdown-panel" role="listbox" aria-label="카테고리 선택">
      <div className="sidebar-category-filter__actions">
        <button className="category-add-button" type="button" data-testid="category-add-button" aria-label="카테고리 추가" title="카테고리 추가" disabled={isComposeScreenOpen || isMutationLocked || isSavingCategory} onClick={() => setIsAddingCategory(true)}>
          <IconPlus className="category-add-button__icon" />
        </button>
        <button className="category-add-button" type="button" data-testid="category-categorize-all-button" aria-label="미분류 메모 AI 자동 분류" title="미분류 메모 AI 자동 분류" aria-busy={isCategorizingAll} disabled={isComposeScreenOpen || isMutationLocked || isCategorizingAll} onClick={() => void runCategorizeAllUncategorized()}>
          <IconSparkles className={`category-add-button__icon${isCategorizingAll ? " is-spinning" : ""}`} />
        </button>
        {isCategorizingAll ? (
          <span className="category-categorize-all-status" data-testid="category-categorize-all-status">
            AI 분류 중...
          </span>
        ) : null}
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
      <button className="category-dropdown-item__main category-dropdown-item--all" type="button" data-testid="category-filter-all" aria-selected={categoryFilter === "all"} onClick={() => selectAllCategoryFilter({ setCategoryFilter, closeDropdown })}>
        <IconFolder className="category-dropdown-item__icon" />
        <span className="category-dropdown-item__label">전체</span>
      </button>
      {categories.map((category) => (
        <CategoryDropdownItem
          key={category.id}
          active={categoryFilter === category.id}
          category={category}
          count={categoryCounts[category.id] ?? 0}
          isMutationLocked={isMutationLocked}
          onSelect={() => selectCategoryFilter(category.id, { setCategoryFilter, closeDropdown })}
          onRequestEdit={() => setEditingCategory(category)}
          onRequestDelete={() => setDeletingCategory(category)}
        />
      ))}
      {editingCategory ? (
        <CategoryEditModal category={editingCategory} isMutationLocked={isMutationLocked} updateCategory={updateCategory} onClose={() => setEditingCategory(null)} />
      ) : null}
      {deletingCategory ? (
        <CategoryDeleteModal category={deletingCategory} isMutationLocked={isMutationLocked} deleteCategory={deleteCategory} onClose={() => setDeletingCategory(null)} />
      ) : null}
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

function selectAllCategoryFilter({ closeDropdown, setCategoryFilter }: Pick<SidebarProps, "setCategoryFilter"> & { closeDropdown: () => void }) {
  setCategoryFilter("all");
  closeDropdown();
}

function selectCategoryFilter(category: MemoCategory, { closeDropdown, setCategoryFilter }: Pick<SidebarProps, "setCategoryFilter"> & { closeDropdown: () => void }) {
  setCategoryFilter(category);
  closeDropdown();
}

type CategoryDropdownItemProps = {
  active: boolean;
  category: MemoCategoryDefinition;
  count: number;
  isMutationLocked: boolean;
  onSelect: () => void;
  onRequestEdit: () => void;
  onRequestDelete: () => void;
};

function CategoryDropdownItem({ active, category, count, isMutationLocked, onSelect, onRequestEdit, onRequestDelete }: CategoryDropdownItemProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className={`category-dropdown-item${active ? " is-active" : ""}`} onContextMenu={(event) => openCategoryMenu(event, setMenuPosition)}>
      <button className="category-dropdown-item__main" type="button" data-testid={`category-filter-${category.id}`} aria-selected={active} onClick={onSelect}>
        <IconFolder className="category-dropdown-item__icon" />
        <span className="category-dropdown-item__label">{category.label}</span>
        <span className="category-dropdown-item__count">{count}</span>
      </button>
      {menuPosition ? (
        <CategoryDropdownItemMenu
          categoryId={category.id}
          isMutationLocked={isMutationLocked}
          position={menuPosition}
          onEdit={() => {
            setMenuPosition(null);
            onRequestEdit();
          }}
          onDelete={() => {
            setMenuPosition(null);
            onRequestDelete();
          }}
          onClose={() => setMenuPosition(null)}
        />
      ) : null}
    </div>
  );
}

function openCategoryMenu(event: MouseEvent<HTMLDivElement>, setMenuPosition: Dispatch<SetStateAction<{ x: number; y: number } | null>>) {
  event.preventDefault();
  setMenuPosition({ x: event.clientX, y: event.clientY });
}

function CategoryDropdownItemMenu({
  categoryId,
  isMutationLocked,
  position,
  onClose,
  onDelete,
  onEdit
}: {
  categoryId: MemoCategory;
  isMutationLocked: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return createPortal(
    <>
      <div className="category-dropdown-item__menu-backdrop" onClick={onClose} />
      <div className="category-dropdown-item__menu" style={{ top: position.y, left: position.x }} onClick={(event) => event.stopPropagation()}>
        <button className="category-dropdown-item__menu-item" type="button" data-testid={`category-edit-${categoryId}`} disabled={isMutationLocked} onClick={onEdit}>
          수정
        </button>
        <button className="category-dropdown-item__menu-item category-dropdown-item__menu-item--danger" type="button" data-testid={`category-delete-${categoryId}`} disabled={isMutationLocked} onClick={onDelete}>
          삭제
        </button>
      </div>
    </>,
    document.body
  );
}

type CategoryEditModalProps = {
  category: MemoCategoryDefinition;
  isMutationLocked: boolean;
  updateCategory: (categoryId: MemoCategory, patch: MemoCategoryUpdateInput) => Promise<MemoCategoryDefinition | null>;
  onClose: () => void;
};

function CategoryEditModal({ category, isMutationLocked, updateCategory, onClose }: CategoryEditModalProps) {
  const [draftLabel, setDraftLabel] = useState(category.label);
  const [draftDescription, setDraftDescription] = useState(category.description);
  const [isSaving, setIsSaving] = useState(false);
  const titleId = `category-edit-modal-title-${category.id}`;

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    const updatedCategory = await updateCategory(category.id, { label: draftLabel, description: draftDescription });
    setIsSaving(false);

    if (updatedCategory) {
      onClose();
    }
  }

  return createPortal(
    <div className="delete-modal-backdrop" data-testid={`category-edit-modal-${category.id}`} onClick={onClose}>
      <form className="delete-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={stopPropagation} onSubmit={submitEdit}>
        <h2 id={titleId}>카테고리 수정</h2>
        <label className="category-edit-form__field">
          <span className="category-edit-form__label">이름</span>
          <input className="category-edit-form__input" data-testid={`category-edit-label-${category.id}`} type="text" value={draftLabel} maxLength={32} autoFocus disabled={isSaving || isMutationLocked} onChange={(event) => setDraftLabel(event.target.value)} />
        </label>
        <label className="category-edit-form__field">
          <span className="category-edit-form__label">설명</span>
          <textarea className="category-edit-form__textarea" data-testid={`category-edit-description-${category.id}`} value={draftDescription} maxLength={200} rows={3} placeholder="이 카테고리에 어떤 메모가 들어가는지 설명을 입력해 주세요." disabled={isSaving || isMutationLocked} onChange={(event) => setDraftDescription(event.target.value)} />
        </label>
        <div className="delete-modal-actions">
          <button className="paper-button" type="button" data-testid={`category-edit-cancel-${category.id}`} disabled={isSaving} onClick={onClose}>
            취소
          </button>
          <button className="paper-button paper-button-primary" type="submit" data-testid={`category-edit-submit-${category.id}`} disabled={isSaving || isMutationLocked || draftLabel.trim().length === 0}>
            저장
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

type CategoryDeleteModalProps = {
  category: MemoCategoryDefinition;
  isMutationLocked: boolean;
  deleteCategory: (categoryId: MemoCategory) => Promise<boolean>;
  onClose: () => void;
};

function CategoryDeleteModal({ category, isMutationLocked, deleteCategory, onClose }: CategoryDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const titleId = `category-delete-modal-title-${category.id}`;
  const descriptionId = `category-delete-modal-description-${category.id}`;

  async function confirmDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    const deleted = await deleteCategory(category.id);
    setIsDeleting(false);

    if (deleted) {
      onClose();
    }
  }

  return createPortal(
    <div className="delete-modal-backdrop" data-testid={`category-delete-modal-${category.id}`} onClick={onClose}>
      <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onClick={stopPropagation}>
        <h2 id={titleId}>카테고리를 삭제할까요?</h2>
        <p id={descriptionId}>&quot;{category.label}&quot; 카테고리를 삭제하면 이 카테고리로 분류된 메모는 미분류로 변경돼요.</p>
        {category.description ? <p className="category-delete-confirm__description">{category.description}</p> : null}
        <div className="delete-modal-actions">
          <button className="paper-button" type="button" data-testid={`category-delete-cancel-${category.id}`} disabled={isDeleting} onClick={onClose}>
            취소
          </button>
          <button className="paper-button paper-button-danger" type="button" data-testid={`category-delete-confirm-${category.id}-button`} disabled={isDeleting || isMutationLocked} onClick={() => void confirmDelete()}>
            정말 삭제
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
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
