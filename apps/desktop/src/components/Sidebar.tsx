import { useState } from "react";
import { createPortal } from "react-dom";
import type { Dispatch, FormEvent, KeyboardEvent, MouseEvent, RefObject, SetStateAction } from "react";
import type { MemoCategory, MemoCategoryDefinition, MemoCategoryUpdateInput, MemoId } from "@ai-note/shared/memo";
import { deriveNoteHeadline } from "../note-content";
import { IconBolt, IconChat, IconCheck, IconClose, IconFolder, IconPlus, IconSparkles, IconTrash } from "./icons";
import { canOpenQuickCaptureWindow, isMacOSPlatform, openQuickCaptureWindow } from "../infrastructure/desktop-window";
import { buildFolderTree, getCategoryDisplayLabel } from "../domain/categories";
import type { FolderNode } from "../domain/categories";
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
  notes: Note[];
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
  createCategory: (label: string, parentId?: string | null) => Promise<MemoCategoryDefinition | null>;
  deleteCategory: (categoryId: MemoCategory) => Promise<boolean>;
  deleteUnusedCategories: (categoryIds: MemoCategory[]) => Promise<void>;
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
      <SidebarNav {...props} />
      <SidebarBody {...props} />
      <SidebarStorageNotice {...props} />
    </aside>
  );
}

/* ── Head ── */
function SidebarHead(props: SidebarProps) {
  return (
    <div className="sidebar-head" data-testid="app-brand-mark">
      <SidebarActions {...props} />
      <SidebarSearch {...props} />
    </div>
  );
}

function SidebarActions({ isAiChatOpen, isMutationLocked, isStickyMode, toggleAiChatPanel }: SidebarProps) {
  if (isStickyMode) return null;
  return (
    <div className="sidebar-actions-row">
      <QuickCaptureButton />
      <AiChatToggleButton isAiChatOpen={isAiChatOpen} isMutationLocked={isMutationLocked} toggleAiChatPanel={toggleAiChatPanel} />
    </div>
  );
}

function QuickCaptureButton() {
  if (!canOpenQuickCaptureWindow()) return null;
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
    <button className={`sidebar-ai-chat-button sidebar-ai-chat-button--icon${isAiChatOpen ? " is-active" : ""}`} type="button" data-testid="sidebar-ai-chat-button" aria-label={isAiChatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"} aria-pressed={isAiChatOpen} disabled={isMutationLocked && !isAiChatOpen} onClick={toggleAiChatPanel}>
      <IconChat className="button-icon" />
      <span className="visually-hidden">{isAiChatOpen ? "AI 채팅 닫기" : "AI 채팅 열기"}</span>
    </button>
  );
}

function SidebarSearch({ handleSearch, query, searchInputRef }: SidebarProps) {
  return (
    <label className="sidebar-search">
      <span className="visually-hidden">키워드 검색</span>
      <input
        ref={searchInputRef}
        type="text"
        placeholder="키워드 검색"
        data-testid="note-search-input"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); searchInputRef.current?.blur(); } }}
      />
    </label>
  );
}

/* ── Tab nav: 전체 | 즐겨찾기 | 폴더 ── */
function SidebarNav({ isComposeScreenOpen, sidebarView, switchSidebarView, setCategoryFilter }: SidebarProps) {
  function switchTo(view: SidebarView) {
    if (view !== "folders") setCategoryFilter("all");
    switchSidebarView(view);
  }

  return (
    <nav className="sidebar-tab-nav" aria-label="보기 선택">
      <button
        className={`sidebar-tab-nav__tab${sidebarView === "all" ? " is-active" : ""}`}
        type="button"
        data-testid="sidebar-all-view-button"
        disabled={isComposeScreenOpen}
        onClick={() => switchTo("all")}
      >
        전체
      </button>
      <button
        className={`sidebar-tab-nav__tab${sidebarView === "favorites" ? " is-active" : ""}`}
        type="button"
        data-testid="sidebar-favorites-view-button"
        disabled={isComposeScreenOpen}
        onClick={() => switchTo("favorites")}
      >
        즐겨찾기
      </button>
      <button
        className={`sidebar-tab-nav__tab${sidebarView === "folders" ? " is-active" : ""}`}
        type="button"
        data-testid="sidebar-folders-view-button"
        disabled={isComposeScreenOpen}
        onClick={() => switchTo("folders")}
      >
        폴더
      </button>
    </nav>
  );
}

/* ── Body dispatcher ── */
function SidebarBody(props: SidebarProps) {
  if (props.activeSidebarSurface === "ai-context") {
    return <ContextSearchPanel {...props} />;
  }
  if (props.sidebarView === "folders") {
    return <FolderTreeSurface {...props} />;
  }
  return <NotesSurface {...props} />;
}

/* ── Notes surface (original, restored) ── */
function NotesSurface(props: SidebarProps) {
  return (
    <div className="sidebar-surface">
      <SidebarSectionHeading {...props} />
      <NotesListOrEmpty {...props} />
    </div>
  );
}

function SidebarSectionHeading(props: SidebarProps) {
  const title = getSidebarSectionTitle(props);
  return (
    <div className="sidebar-section-heading">
      <span className="sidebar-section-heading__label">
        <span>{title}</span>
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
    return (
      <ul className="note-list" aria-label="메모 목록" data-testid="note-list">
        {props.filteredNotes.map((note) => <NoteListItem key={note.id} note={note} {...props} />)}
      </ul>
    );
  }
  return <NotesEmptyState {...props} />;
}

function NoteListItem(props: SidebarProps & { note: Note }) {
  const isSelected = props.activeNote?.id === props.note.id;
  const noteLabel = deriveNoteHeadline(props.note.body);
  const isNoteMenuOpen = props.noteMenuId === props.note.id;
  const noteMenuIdValue = `note-actions-menu-${props.note.id}`;

  function handleClick() {
    if (props.isComposeScreenOpen) return;
    props.setSelectedNoteId(props.note.id);
    props.setDeleteIntentId(null);
    props.setNoteMenuId(null);
  }

  return (
    <li
      className={`note-list-item${isSelected ? " is-selected" : ""}`}
      data-mode={props.note.mode}
      onClick={handleClick}
      onContextMenu={(e: MouseEvent<HTMLLIElement>) => { if (!props.isComposeScreenOpen) { e.preventDefault(); props.toggleNoteMenu(props.note.id); } }}
    >
      <button className="note-list-item-button" data-testid={`note-list-item-${props.note.id}`} type="button" disabled={props.isComposeScreenOpen} aria-current={isSelected ? "true" : undefined} aria-label={`${noteLabel} 메모`} aria-expanded={isNoteMenuOpen} aria-controls={isNoteMenuOpen ? noteMenuIdValue : undefined} onClick={handleClick}>
        <span className="note-list-copy">
          <strong>{noteLabel}</strong>
          <span className="note-list-meta">
            <span className="note-list-date">{props.note.dateLabel === "이제" ? props.note.updatedAt : props.note.dateLabel}</span>
            {props.note.category ? <span className="note-category-badge">{getCategoryDisplayLabel(props.categories, props.note.category)}</span> : null}
          </span>
        </span>
      </button>
      {isNoteMenuOpen ? (
        <div className="note-list-menu" id={noteMenuIdValue} data-note-menu-root="true" onClick={(e) => e.stopPropagation()}>
          <button className="note-list-menu-item note-list-menu-item-danger" type="button" data-testid="selected-note-delete-button" disabled={props.isMutationLocked} onClick={() => props.beginDeleteNote(props.note.id)}>
            삭제
          </button>
        </div>
      ) : null}
    </li>
  );
}

function NotesEmptyState(props: SidebarProps) {
  return (
    <section className="note-list sidebar-empty" data-testid="sidebar-empty-state">
      <strong>{getSidebarEmptyTitle(props)}</strong>
      <p>{getSidebarEmptyText(props)}</p>
      {props.shouldShowStorageNotice && props.storageStatusSummary ? (
        <p className={`sidebar-empty-status${props.storageHealthReady ? "" : " is-warning"}`} data-testid="sidebar-storage-summary">{props.storageStatusSummary}</p>
      ) : null}
    </section>
  );
}

function getSidebarSectionTitle({ categories, categoryFilter, sidebarView }: SidebarProps) {
  if (categoryFilter !== "all") return getCategoryDisplayLabel(categories, categoryFilter);
  return sidebarView === "favorites" ? "즐겨찾기" : "최근";
}

function getSidebarEmptyTitle({ categories, categoryFilter, hasQuery, isCollectionEmpty, sidebarView }: SidebarProps) {
  if (isCollectionEmpty) return "메모가 없어요";
  if (categoryFilter !== "all" && !hasQuery) return `${getCategoryDisplayLabel(categories, categoryFilter)} 메모가 없어요`;
  if (sidebarView === "favorites" && !hasQuery) return "즐겨찾기가 없어요";
  return "검색 결과가 없어요";
}

function getSidebarEmptyText({ categoryFilter, hasQuery, isCollectionEmpty, sidebarView }: SidebarProps) {
  if (isCollectionEmpty) return "새 메모를 만들면 바로 목록에 나타나요.";
  if (categoryFilter !== "all" && !hasQuery) return "해당 폴더로 분류된 메모가 아직 없어요.";
  if (sidebarView === "favorites" && !hasQuery) return "메모 오른쪽 위 별 버튼을 누르면 즐겨찾기 목록에 모아볼 수 있어요.";
  return "다른 검색어를 입력하거나 검색을 해제해 주세요.";
}

/* ── Folder tree surface ── */
function FolderTreeSurface(props: SidebarProps) {
  const { notes, categories, activeNote, categoryCounts } = props;
  const tree = buildFolderTree(categories);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [addingInFolder, setAddingInFolder] = useState<string | null | "root">(null);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectNote(noteId: MemoId) {
    if (props.isComposeScreenOpen) return;
    props.setSelectedNoteId(noteId);
    props.setDeleteIntentId(null);
    props.setNoteMenuId(null);
  }

  const uncategorizedNotes = notes.filter((n) => !n.category);

  return (
    <div className="sidebar-surface folder-tree-surface">
      {/* 헤더 */}
      <div className="sidebar-section-heading">
        <span className="sidebar-section-heading__label">
          <span>폴더</span>
        </span>
        <FolderActions {...props} onAddInRoot={() => setAddingInFolder("root")} />
      </div>

      <ul className="folder-tree" aria-label="폴더 트리">
        {/* 폴더 트리 */}
        {tree.map((node) => (
          <FolderTreeNode
            key={node.folder.id}
            node={node}
            depth={0}
            notes={notes}
            activeNote={activeNote}
            expandedIds={expandedIds}
            addingInFolder={addingInFolder}
            isComposeScreenOpen={props.isComposeScreenOpen}
            isMutationLocked={props.isMutationLocked}
            noteMenuId={props.noteMenuId}
            categories={categories}
            categoryCounts={categoryCounts}
            onToggleExpand={toggleExpanded}
            onSelectNote={selectNote}
            onContextMenuNote={(nid) => props.toggleNoteMenu(nid)}
            onAddSubFolder={(parentId) => setAddingInFolder(parentId)}
            onCancelAdd={() => setAddingInFolder(null)}
            onSubmitAdd={async (label, parentId) => { await props.createCategory(label, parentId); setAddingInFolder(null); }}
            onUpdateCategory={props.updateCategory}
            onDeleteCategory={props.deleteCategory}
            beginDeleteNote={props.beginDeleteNote}
          />
        ))}

        {/* 루트 폴더 추가 폼 */}
        {addingInFolder === "root" && (
          <li>
            <AddFolderForm
              onSubmit={async (label) => { await props.createCategory(label, null); setAddingInFolder(null); }}
              onCancel={() => setAddingInFolder(null)}
            />
          </li>
        )}

        {/* 미분류 */}
        {uncategorizedNotes.length > 0 && (
          <li>
            <div className="folder-tree__item-row">
              <button
                className={`folder-tree__chevron${expandedIds.has("__uncategorized__") ? " is-open" : ""}`}
                type="button"
                aria-label={expandedIds.has("__uncategorized__") ? "접기" : "펼치기"}
                disabled={props.isComposeScreenOpen}
                onClick={() => toggleExpanded("__uncategorized__")}
              >
                <ChevronIcon />
              </button>
              <button
                className="folder-tree__item-main"
                type="button"
                disabled={props.isComposeScreenOpen}
                onClick={() => toggleExpanded("__uncategorized__")}
              >
                <IconFolder className="folder-tree__item-icon" />
                <span className="folder-tree__item-label">미분류</span>
                <span className="folder-tree__item-count">{uncategorizedNotes.length}</span>
              </button>
            </div>
            {expandedIds.has("__uncategorized__") && (
              <ul className="folder-tree__children">
                {uncategorizedNotes.map((n) => (
                  <TreeNoteRow key={n.id} note={n} activeNoteId={activeNote?.id ?? ""} depth={1} isComposeScreenOpen={props.isComposeScreenOpen} isMutationLocked={props.isMutationLocked} noteMenuId={props.noteMenuId} onSelect={selectNote} onContextMenu={(nid) => props.toggleNoteMenu(nid)} beginDeleteNote={props.beginDeleteNote} />
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>

      {/* 새 메모 버튼 */}
      <div className="folder-tree__create-row">
        <button
          className="paper-button paper-button-icon sidebar-create-button"
          type="button"
          data-testid="sidebar-create-note-button"
          aria-label="새 메모 만들기"
          title="새 메모 만들기"
          disabled={props.isMutationLocked || props.isComposeScreenOpen}
          onClick={() => void props.handleCreateNote()}
        >
          <IconPlus className="button-icon" />
          <span className="visually-hidden">새 메모 만들기</span>
        </button>
      </div>
    </div>
  );
}

/* ── Folder actions (AI, cleanup, add) ── */
function FolderActions(props: SidebarProps & { onAddInRoot: () => void }) {
  const { categories, categoryCounts, isCategorizingAll, isComposeScreenOpen, isMutationLocked, deleteUnusedCategories, runCategorizeAllUncategorized, onAddInRoot } = props;
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const unusedIds = categories.filter((c) => !c.builtin && (categoryCounts[c.id] ?? 0) === 0).map((c) => c.id);

  async function handleCleanup() {
    if (isCleaningUp || unusedIds.length === 0) return;
    setIsCleaningUp(true);
    await deleteUnusedCategories(unusedIds);
    setIsCleaningUp(false);
  }

  return (
    <div className="folder-list__section-actions">
      {isCategorizingAll ? <span className="category-categorize-all-status">AI 분류 중...</span> : null}
      <button className="folder-list__add-button" type="button" aria-label="미분류 메모 AI 자동 분류" title="미분류 메모 AI 자동 분류" aria-busy={isCategorizingAll} disabled={isComposeScreenOpen || isMutationLocked || isCategorizingAll} onClick={() => void runCategorizeAllUncategorized()}>
        <IconSparkles className={`folder-list__create-btn-icon${isCategorizingAll ? " folder-list__ai-spinner" : ""}`} />
      </button>
      {unusedIds.length > 0 && (
        <button className="folder-list__add-button" type="button" aria-label="빈 폴더 정리" title="빈 폴더 정리" disabled={isComposeScreenOpen || isMutationLocked || isCleaningUp} onClick={() => void handleCleanup()}>
          <IconTrash className="folder-list__create-btn-icon" />
        </button>
      )}
      <button className="folder-list__add-button" type="button" data-testid="category-add-button" aria-label="새 폴더" title="새 폴더" disabled={isComposeScreenOpen || isMutationLocked} onClick={onAddInRoot}>
        <IconPlus className="folder-list__create-btn-icon" />
      </button>
    </div>
  );
}

/* ── Recursive folder node ── */
type FolderTreeNodeProps = {
  node: FolderNode;
  depth: number;
  notes: Note[];
  activeNote: Note | null;
  expandedIds: Set<string>;
  addingInFolder: string | null | "root";
  isComposeScreenOpen: boolean;
  isMutationLocked: boolean;
  noteMenuId: MemoId | null;
  categories: MemoCategoryDefinition[];
  categoryCounts: Record<MemoCategory, number>;
  onToggleExpand: (id: string) => void;
  onSelectNote: (id: MemoId) => void;
  onContextMenuNote: (id: MemoId) => void;
  onAddSubFolder: (parentId: string) => void;
  onCancelAdd: () => void;
  onSubmitAdd: (label: string, parentId: string) => Promise<void>;
  onUpdateCategory: (id: MemoCategory, patch: MemoCategoryUpdateInput) => Promise<MemoCategoryDefinition | null>;
  onDeleteCategory: (id: MemoCategory) => Promise<boolean>;
  beginDeleteNote: (id?: MemoId) => void;
};

function FolderTreeNode({ node, depth, notes, activeNote, expandedIds, addingInFolder, isComposeScreenOpen, isMutationLocked, noteMenuId, categories, categoryCounts, onToggleExpand, onSelectNote, onContextMenuNote, onAddSubFolder, onCancelAdd, onSubmitAdd, onUpdateCategory, onDeleteCategory, beginDeleteNote }: FolderTreeNodeProps) {
  const { folder, children } = node;
  const isExpanded = expandedIds.has(folder.id);
  const folderNotes = notes.filter((n) => n.category === folder.id);
  const count = categoryCounts[folder.id] ?? 0;
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [editingCategory, setEditingCategory] = useState<MemoCategoryDefinition | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<MemoCategoryDefinition | null>(null);
  const indentPx = depth * 16;

  return (
    <li>
      <div
        className="folder-tree__item-row"
        style={{ paddingLeft: `${indentPx}px` }}
        onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); }}
      >
        <button
          className={`folder-tree__chevron${isExpanded ? " is-open" : ""}`}
          type="button"
          aria-label={isExpanded ? "접기" : "펼치기"}
          disabled={isComposeScreenOpen}
          onClick={() => onToggleExpand(folder.id)}
        >
          <ChevronIcon />
        </button>
        <button
          className="folder-tree__item-main"
          type="button"
          data-testid={`category-filter-${folder.id}`}
          disabled={isComposeScreenOpen}
          onClick={() => onToggleExpand(folder.id)}
        >
          <IconFolder className="folder-tree__item-icon" />
          <span className="folder-tree__item-label">{folder.label}</span>
          {count > 0 && <span className="folder-tree__item-count">{count}</span>}
        </button>
        <button
          className="folder-tree__add-sub"
          type="button"
          aria-label="하위 폴더 추가"
          title="하위 폴더 추가"
          disabled={isComposeScreenOpen || isMutationLocked}
          onClick={() => { if (!isExpanded) onToggleExpand(folder.id); onAddSubFolder(folder.id); }}
        >
          <IconPlus className="folder-tree__add-sub-icon" />
        </button>
      </div>

      {isExpanded && (
        <ul className="folder-tree__children">
          {children.map((child) => (
            <FolderTreeNode
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              notes={notes}
              activeNote={activeNote}
              expandedIds={expandedIds}
              addingInFolder={addingInFolder}
              isComposeScreenOpen={isComposeScreenOpen}
              isMutationLocked={isMutationLocked}
              noteMenuId={noteMenuId}
              categories={categories}
              categoryCounts={categoryCounts}
              onToggleExpand={onToggleExpand}
              onSelectNote={onSelectNote}
              onContextMenuNote={onContextMenuNote}
              onAddSubFolder={onAddSubFolder}
              onCancelAdd={onCancelAdd}
              onSubmitAdd={onSubmitAdd}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
              beginDeleteNote={beginDeleteNote}
            />
          ))}
          {addingInFolder === folder.id && (
            <li style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
              <AddFolderForm
                onSubmit={(label) => onSubmitAdd(label, folder.id)}
                onCancel={onCancelAdd}
              />
            </li>
          )}
          {folderNotes.map((n) => (
            <TreeNoteRow
              key={n.id}
              note={n}
              activeNoteId={activeNote?.id ?? ""}
              depth={depth + 1}
              isComposeScreenOpen={isComposeScreenOpen}
              isMutationLocked={isMutationLocked}
              noteMenuId={noteMenuId}
              onSelect={onSelectNote}
              onContextMenu={onContextMenuNote}
              beginDeleteNote={beginDeleteNote}
            />
          ))}
          {children.length === 0 && folderNotes.length === 0 && addingInFolder !== folder.id && (
            <li className="folder-tree__empty-hint" style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}>
              메모 없음
            </li>
          )}
        </ul>
      )}

      {menuPos && (
        <FolderContextMenu
          categoryId={folder.id}
          isMutationLocked={isMutationLocked}
          position={menuPos}
          onEdit={() => { setMenuPos(null); setEditingCategory(folder); }}
          onDelete={() => { setMenuPos(null); setDeletingCategory(folder); }}
          onAddSub={() => { setMenuPos(null); if (!isExpanded) onToggleExpand(folder.id); onAddSubFolder(folder.id); }}
          onClose={() => setMenuPos(null)}
        />
      )}
      {editingCategory && (
        <CategoryEditModal
          category={editingCategory}
          isMutationLocked={isMutationLocked}
          updateCategory={onUpdateCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}
      {deletingCategory && (
        <CategoryDeleteModal
          category={deletingCategory}
          count={categoryCounts[deletingCategory.id] ?? 0}
          isMutationLocked={isMutationLocked}
          deleteCategory={onDeleteCategory}
          onClose={() => setDeletingCategory(null)}
        />
      )}
    </li>
  );
}

/* ── Tree note row ── */
function TreeNoteRow({ note, activeNoteId, depth = 0, isComposeScreenOpen, isMutationLocked, noteMenuId, onSelect, onContextMenu, beginDeleteNote }: {
  note: Note;
  activeNoteId: string;
  depth?: number;
  isComposeScreenOpen: boolean;
  isMutationLocked: boolean;
  noteMenuId: MemoId | null;
  onSelect: (id: MemoId) => void;
  onContextMenu: (id: MemoId) => void;
  beginDeleteNote: (id?: MemoId) => void;
}) {
  const isSelected = activeNoteId === note.id;
  const headline = deriveNoteHeadline(note.body);
  const isMenuOpen = noteMenuId === note.id;
  const indentPx = depth * 16 + 24;

  return (
    <li
      className={`folder-tree__note${isSelected ? " is-selected" : ""}`}
      style={{ paddingLeft: `${indentPx}px` }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(note.id); }}
    >
      <button
        className="folder-tree__note-btn"
        type="button"
        data-testid={`note-list-item-${note.id}`}
        disabled={isComposeScreenOpen}
        aria-current={isSelected ? "true" : undefined}
        onClick={() => onSelect(note.id)}
      >
        <NoteThumbIcon hasCheckbox={/^- \[[ xX]\] /m.test(note.body)} />
        <span className="folder-tree__note-label">{headline}</span>
        <span className="folder-tree__note-date">{note.dateLabel}</span>
      </button>
      {isMenuOpen && (
        <div className="note-list-menu" data-note-menu-root="true" onClick={(e) => e.stopPropagation()}>
          <button className="note-list-menu-item note-list-menu-item-danger" type="button" disabled={isMutationLocked} onClick={() => beginDeleteNote(note.id)}>
            삭제
          </button>
        </div>
      )}
    </li>
  );
}

function NoteThumbIcon({ hasCheckbox }: { hasCheckbox: boolean }) {
  if (hasCheckbox) {
    return (
      <svg className="folder-tree__note-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="folder-tree__note-icon" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="3.5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="3.5" y1="7.5" x2="8.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/* ── Add folder form ── */
function AddFolderForm({ onSubmit, onCancel }: { onSubmit: (label: string) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || !draft.trim()) return;
    setSaving(true);
    await onSubmit(draft.trim());
    setSaving(false);
  }

  return (
    <form className="folder-list__create-form" onSubmit={handleSubmit} data-testid="category-create-form">
      <input className="folder-list__create-input" data-testid="category-create-input" type="text" value={draft} maxLength={32} autoFocus placeholder="폴더 이름" disabled={saving} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }} />
      <button className="folder-list__create-btn" type="submit" aria-label="저장" disabled={saving || !draft.trim()}>
        <IconCheck className="folder-list__create-btn-icon" />
      </button>
      <button className="folder-list__create-btn" type="button" aria-label="취소" disabled={saving} onClick={onCancel}>
        <IconClose className="folder-list__create-btn-icon" />
      </button>
    </form>
  );
}

/* ── Chevron icon ── */
function ChevronIcon({ className }: { className?: string } = {}) {
  return (
    <svg className={className} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Folder context menu ── */
function FolderContextMenu({ categoryId, isMutationLocked, position, onClose, onDelete, onEdit, onAddSub }: {
  categoryId: MemoCategory;
  isMutationLocked: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onAddSub: () => void;
}) {
  return createPortal(
    <>
      <div className="category-dropdown-backdrop" onClick={onClose} />
      <div className="category-dropdown-item__menu" style={{ top: position.y, left: position.x }} onClick={(e) => e.stopPropagation()}>
        <button className="category-dropdown-item__menu-item" type="button" disabled={isMutationLocked} onClick={onAddSub}>하위 폴더 추가</button>
        <button className="category-dropdown-item__menu-item" type="button" data-testid={`category-edit-${categoryId}`} disabled={isMutationLocked} onClick={onEdit}>이름 수정</button>
        <button className="category-dropdown-item__menu-item category-dropdown-item__menu-item--danger" type="button" data-testid={`category-delete-${categoryId}`} disabled={isMutationLocked} onClick={onDelete}>삭제</button>
      </div>
    </>,
    document.body
  );
}

/* ── Category edit modal ── */
function CategoryEditModal({ category, isMutationLocked, updateCategory, onClose }: {
  category: MemoCategoryDefinition;
  isMutationLocked: boolean;
  updateCategory: (id: MemoCategory, patch: MemoCategoryUpdateInput) => Promise<MemoCategoryDefinition | null>;
  onClose: () => void;
}) {
  const [draftLabel, setDraftLabel] = useState(category.label);
  const [isSaving, setIsSaving] = useState(false);
  const titleId = `category-edit-modal-title-${category.id}`;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const updated = await updateCategory(category.id, { label: draftLabel });
    setIsSaving(false);
    if (updated) onClose();
  }

  return createPortal(
    <div className="delete-modal-backdrop" data-testid={`category-edit-modal-${category.id}`} onClick={onClose}>
      <form className="delete-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 id={titleId}>폴더 이름 수정</h2>
        <label className="category-edit-form__field">
          <span className="category-edit-form__label">이름</span>
          <input className="category-edit-form__input" data-testid={`category-edit-label-${category.id}`} type="text" value={draftLabel} maxLength={32} autoFocus disabled={isSaving || isMutationLocked} onChange={(e) => setDraftLabel(e.target.value)} />
        </label>
        <div className="delete-modal-actions">
          <button className="paper-button" type="button" disabled={isSaving} onClick={onClose}>취소</button>
          <button className="paper-button paper-button-primary" type="submit" disabled={isSaving || isMutationLocked || draftLabel.trim().length === 0}>저장</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

/* ── Category delete modal ── */
function CategoryDeleteModal({ category, count, isMutationLocked, deleteCategory, onClose }: {
  category: MemoCategoryDefinition;
  count: number;
  isMutationLocked: boolean;
  deleteCategory: (id: MemoCategory) => Promise<boolean>;
  onClose: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const titleId = `category-delete-modal-title-${category.id}`;

  async function confirmDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    const deleted = await deleteCategory(category.id);
    setIsDeleting(false);
    if (deleted) onClose();
  }

  return createPortal(
    <div className="delete-modal-backdrop" data-testid={`category-delete-modal-${category.id}`} onClick={onClose}>
      <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>폴더를 삭제할까요?</h2>
        <p>{count > 0 ? `"${category.label}" 폴더를 삭제하면 이 폴더의 메모 ${count}개는 미분류로 변경돼요.` : `"${category.label}" 폴더에는 메모가 없어요.`}</p>
        <div className="delete-modal-actions">
          <button className="paper-button" type="button" disabled={isDeleting} onClick={onClose}>취소</button>
          <button className="paper-button paper-button-danger" type="button" data-testid={`category-delete-confirm-${category.id}-button`} disabled={isDeleting || isMutationLocked} onClick={() => void confirmDelete()}>정말 삭제</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

/* ── Context search surface ── */
function ContextSearchPanel({ activeNote, closeContextSearchPanel, contextSearch, openNoteFromContextSearch, runContextSearch }: SidebarProps) {
  return (
    <section className="sidebar-surface sidebar-context-search" data-testid="context-search-panel">
      <div className="sidebar-surface__header">
        <div className="sidebar-surface__title-block">
          <strong>AI 검색</strong>
          <span>질문처럼 적으면 관련 메모와 이유를 함께 보여줍니다.</span>
        </div>
        <div className="sidebar-surface__actions">
          <button className={`paper-button paper-button-primary${contextSearch.isLoading ? " is-loading" : ""}`} type="button" data-testid="submit-context-search-button" disabled={contextSearch.isLoading || contextSearch.query.trim().length === 0} onClick={() => void runContextSearch()}>실행</button>
          <button className="paper-button" type="button" onClick={closeContextSearchPanel}>닫기</button>
        </div>
      </div>
      <ContextSearchBody activeNote={activeNote} contextSearch={contextSearch} openNoteFromContextSearch={openNoteFromContextSearch} />
    </section>
  );
}

function ContextSearchBody({ activeNote, contextSearch, openNoteFromContextSearch }: Pick<SidebarProps, "activeNote" | "contextSearch" | "openNoteFromContextSearch">) {
  if (contextSearch.results.length > 0) {
    return (
      <ul className="note-list" data-testid="context-search-results">
        {contextSearch.results.map((result) => (
          <li key={result.memo.id} className={`note-list-item is-context-result${activeNote?.id === result.memo.id ? " is-selected" : ""}`}>
            <button className="note-list-item-button" type="button" data-testid={`open-context-search-result-${result.memo.id}`} onClick={() => openNoteFromContextSearch(result.memo.id)}>
              <span className="note-list-copy">
                <strong>{deriveNoteHeadline(result.memo.body)}</strong>
                <span className="note-list-date">{result.memo.updatedAt}</span>
                <span className="note-list-preview">{result.preview || result.reason}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }
  if (contextSearch.isLoading) return <section className="note-list sidebar-empty"><strong>관련 메모를 찾고 있어요</strong></section>;
  if (contextSearch.hasSearched) return <section className="note-list sidebar-empty"><strong>관련 메모를 찾지 못했어요</strong><p>다른 표현으로 다시 검색해 보세요.</p></section>;
  return <section className="note-list sidebar-empty"><strong>자연어로 관련 메모를 찾습니다</strong></section>;
}

/* ── Storage notice ── */
function SidebarStorageNotice({ shouldShowStorageNotice, storageBadgeClassName, storageBadgeLabel, storageStatusSummary }: SidebarProps) {
  if (!shouldShowStorageNotice) return null;
  return (
    <footer className="sidebar-foot" data-testid="storage-notice">
      <span className={`${storageBadgeClassName} sidebar-foot-badge`} data-testid="storage-status-badge">{storageBadgeLabel}</span>
      {storageStatusSummary ? <p>{storageStatusSummary}</p> : <p>모든 메모는 로컬 저장소에 바로 반영돼요.</p>}
    </footer>
  );
}
