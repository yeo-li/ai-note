import type { Dispatch, FormEvent, KeyboardEvent, RefObject, SetStateAction } from "react";
import { MEMO_CATEGORIES, MEMO_CATEGORY_LABELS } from "@ai-note/shared/memo";
import type { MemoCategory, MemoId } from "@ai-note/shared/memo";
import { IconPin, IconSearch, IconSidebarPanel, IconSparkles, IconStar, IconTag } from "./icons";
import type { PromptTemplate } from "../shared/prompt-template-bridge";
import type { DiffSegment } from "../domain/diff";
import type { FindMatch, Note } from "../domain/note";
import type { TransformDraft, TransformFeedback, TransformSession } from "../domain/transform";
import type { SidebarView } from "../domain/workspace";
import type { PromptTemplateEditorState } from "../hooks/usePromptTemplates";

type EditorFeedback = TransformFeedback | { kind: "progress"; title: string; message: string };

type EditorWorkspaceProps = {
  activeAiPrompt: string;
  activeDraft: TransformDraft | null;
  activeNote: Note | null;
  activeTransformFeedback: EditorFeedback | null;
  aiPromptInputRef: RefObject<HTMLInputElement>;
  categorizingNoteIds: Record<MemoId, boolean>;
  committedFindQuery: string;
  emptyCreateButtonRef: RefObject<HTMLButtonElement>;
  findInputRef: RefObject<HTMLInputElement>;
  findMatches: FindMatch[];
  findMatchIndex: number;
  findQuery: string;
  hasBackup: boolean;
  hasQuery: boolean;
  isActiveNoteBusy: boolean;
  isAnyTransformGenerating: boolean;
  isAiPromptOpen: boolean;
  isCollectionEmpty: boolean;
  isEditorLocked: boolean;
  isFindBarOpen: boolean;
  isMutationLocked: boolean;
  isPreviewActionCoolingDown: boolean;
  isSidebarOpen: boolean;
  isStickyMode: boolean;
  isTransformPreviewGenerating: boolean;
  noteBodyInputRef: RefObject<HTMLTextAreaElement>;
  paperStatusLabel: string;
  previewDiffSegments: DiffSegment[];
  promptTemplateEditor: PromptTemplateEditorState;
  promptTemplates: PromptTemplate[];
  showPaperStatus: boolean;
  showStorageLock: boolean;
  sidebarView: SidebarView;
  storageLockMessage: string;
  applyPromptTemplate: (template: PromptTemplate) => void;
  applyTransformDraft: () => void;
  cancelTransformPreview: () => void;
  closeAiPromptComposer: () => void;
  closeFindBar: (options?: { restoreEditorFocus?: boolean }) => void;
  closePromptTemplateEditor: () => void;
  handleCreateNote: () => Promise<void>;
  handleOpenStickyNoteWindow: () => Promise<void>;
  openAiPromptComposer: () => void;
  openFindBar: () => void;
  openPromptTemplateEditor: (template?: PromptTemplate) => void;
  openSidebar: () => void;
  patchActiveNote: (update: Partial<Note>, message?: string) => void;
  persistPromptTemplate: () => Promise<void>;
  removePromptTemplate: (templateId: string) => Promise<void>;
  restoreOriginal: () => void;
  runAiCategorize: (noteId: MemoId) => Promise<void>;
  searchFind: (direction: 1 | -1) => void;
  setFindQuery: Dispatch<SetStateAction<string>>;
  setNoteCategory: (noteId: MemoId, category: MemoCategory | null) => Promise<void>;
  setPromptTemplateEditor: Dispatch<SetStateAction<PromptTemplateEditorState>>;
  startTransformPreview: () => Promise<void>;
  toggleFavorite: (noteId: string) => void;
  toggleSidebar: () => void;
  updateActiveTransformSession: (updater: (session: TransformSession) => TransformSession | null) => void;
};

export function EditorWorkspace(props: EditorWorkspaceProps) {
  return (
    <div className="paper">
      <PaperHeader {...props} />
      <PaperBody {...props} />
    </div>
  );
}

function PaperHeader(props: EditorWorkspaceProps) {
  return (
    <header className="paper-head">
      <div className="paper-topline">
        <PaperStatus {...props} />
        <EditorToolbar {...props} />
      </div>
      <FindBarSlot {...props} />
      <AiPromptSlot {...props} />
      {props.showStorageLock ? <StorageLockBanner message={props.storageLockMessage} /> : null}
    </header>
  );
}

function PaperStatus({ paperStatusLabel, showPaperStatus }: EditorWorkspaceProps) {
  if (!showPaperStatus) {
    return <div />;
  }

  return (
    <div className="paper-heading paper-heading-compact">
      <span className="paper-heading-status">{paperStatusLabel}</span>
    </div>
  );
}

function EditorToolbar(props: EditorWorkspaceProps) {
  return (
    <div className="paper-heading-tools">
      <div className="paper-toolbar paper-toolbar-editor" role="toolbar" aria-label="메모 도구">
        <div className="paper-toolbar-editor__group paper-toolbar-editor__group--left">
          <SidebarToggleButton {...props} />
        </div>
        <div className="paper-toolbar-editor__group paper-toolbar-editor__group--right">
          <CategorySelector {...props} />
          <AiCategorizeButton {...props} />
          <OpenStickyButton {...props} />
          <FavoriteButton {...props} />
          <OrganizeButton {...props} />
          <FindToggleButton {...props} />
        </div>
      </div>
    </div>
  );
}

function SidebarToggleButton({ isSidebarOpen, toggleSidebar }: EditorWorkspaceProps) {
  return (
    <button className="paper-button paper-button-icon" type="button" data-testid="editor-toggle-sidebar-button" aria-label={isSidebarOpen ? "목록 닫기" : "목록 열기"} title={isSidebarOpen ? "목록 닫기" : "목록 열기"} aria-controls="memo-sidebar" aria-expanded={isSidebarOpen} onClick={toggleSidebar}>
      <IconSidebarPanel open={isSidebarOpen} className="button-icon" />
      <span className="visually-hidden">{isSidebarOpen ? "목록 닫기" : "목록 열기"}</span>
    </button>
  );
}

function OpenStickyButton({ activeNote, handleOpenStickyNoteWindow }: EditorWorkspaceProps) {
  return (
    <button className="paper-button paper-button-icon" type="button" data-testid="open-sticky-note-button" aria-label="스티커 메모로 열기" title="스티커 메모로 열기" disabled={!activeNote} onClick={() => void handleOpenStickyNoteWindow()}>
      <IconPin className="button-icon" />
      <span className="visually-hidden">스티커 메모로 열기</span>
    </button>
  );
}

function FavoriteButton({ activeNote, isActiveNoteBusy, toggleFavorite }: EditorWorkspaceProps) {
  if (!activeNote) {
    return null;
  }

  return (
    <button className={`paper-button paper-button-icon editor-favorite-button${activeNote.favorite ? " is-favorite" : ""}`} type="button" data-testid="selected-note-favorite-button" aria-label={activeNote.favorite ? "즐겨찾기를 해제해요" : "즐겨찾기에 추가해요"} aria-pressed={activeNote.favorite} disabled={isActiveNoteBusy} onClick={() => toggleFavorite(activeNote.id)}>
      <IconStar filled={activeNote.favorite} className="button-icon" />
      <span className="visually-hidden">{activeNote.favorite ? "즐겨찾기를 해제해요" : "즐겨찾기에 추가해요"}</span>
    </button>
  );
}

function CategorySelector({ activeNote, isActiveNoteBusy, isMutationLocked, setNoteCategory }: EditorWorkspaceProps) {
  if (!activeNote) {
    return null;
  }

  return (
    <label className="editor-category-select">
      <span className="visually-hidden">메모 카테고리</span>
      <select data-testid="note-category-select" value={activeNote.category ?? ""} disabled={isMutationLocked || isActiveNoteBusy} onChange={(event) => void setNoteCategory(activeNote.id, toMemoCategory(event.target.value))}>
        <option value="">미분류</option>
        {MEMO_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {MEMO_CATEGORY_LABELS[category]}
          </option>
        ))}
      </select>
    </label>
  );
}

function toMemoCategory(value: string): MemoCategory | null {
  return (MEMO_CATEGORIES as readonly string[]).includes(value) ? (value as MemoCategory) : null;
}

function AiCategorizeButton({ activeNote, categorizingNoteIds, isMutationLocked, isStickyMode, runAiCategorize }: EditorWorkspaceProps) {
  if (!activeNote) {
    return null;
  }

  const isCategorizing = Boolean(categorizingNoteIds[activeNote.id]);
  const disabled = isMutationLocked || isStickyMode || isCategorizing;

  return (
    <button className={`paper-button paper-button-icon${isCategorizing ? " is-loading" : ""}`} type="button" data-testid="ai-categorize-button" aria-label="AI로 카테고리 분류하기" title="AI로 카테고리 분류하기" disabled={disabled} onClick={() => void runAiCategorize(activeNote.id)}>
      <IconTag className="button-icon" />
      <span className="visually-hidden">AI로 카테고리 분류하기</span>
    </button>
  );
}

function OrganizeButton(props: EditorWorkspaceProps) {
  const disabled = props.isMutationLocked || props.isStickyMode || !props.activeNote || props.isAnyTransformGenerating;

  return (
    <button className={`paper-button paper-button-accent${props.isAiPromptOpen ? " is-active" : ""}`} type="button" data-testid="organize-note-button" aria-label="AI로 정리하기" title="AI로 정리하기" aria-pressed={props.isAiPromptOpen} disabled={disabled} onClick={props.openAiPromptComposer}>
      <IconSparkles className="button-icon" />
      <span>AI 정리</span>
    </button>
  );
}

function FindToggleButton(props: EditorWorkspaceProps) {
  const disabled = !props.activeNote || props.isStickyMode || props.isTransformPreviewGenerating;

  return (
    <button className="paper-button paper-button-icon" type="button" data-testid="note-find-toggle-button" aria-label="메모 안에서 찾기" title="메모 안에서 찾기" disabled={disabled} onClick={props.openFindBar}>
      <IconSearch className="button-icon" />
      <span className="visually-hidden">메모 안에서 찾기</span>
    </button>
  );
}

function FindBarSlot(props: EditorWorkspaceProps) {
  if (!props.isFindBarOpen || !props.activeNote || props.activeDraft) {
    return null;
  }

  return <FindBar {...props} />;
}

function FindBar(props: EditorWorkspaceProps) {
  return (
    <div className="note-find-bar" role="search" aria-label="메모 안에서 찾기" data-testid="note-find-bar">
      <label className="note-find-input-shell">
        <span>찾기</span>
        <input ref={props.findInputRef} type="search" data-testid="note-find-input" value={props.findQuery} placeholder="이 메모에서 찾기" onChange={(event) => updateFindQuery(event.target.value, props)} onKeyDown={(event) => handleFindKeyDown(event, props)} />
      </label>
      <span className="note-find-count" data-testid="note-find-count">{getFindCountLabel(props)}</span>
      <FindActions {...props} />
    </div>
  );
}

function updateFindQuery(query: string, { setFindQuery }: EditorWorkspaceProps) {
  setFindQuery(query);
}

function handleFindKeyDown(event: KeyboardEvent<HTMLInputElement>, props: EditorWorkspaceProps) {
  if (event.key === "Enter") {
    event.preventDefault();
    props.searchFind(event.shiftKey ? -1 : 1);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    props.closeFindBar();
  }
}

function getFindCountLabel({ committedFindQuery, findMatches, findMatchIndex, findQuery }: EditorWorkspaceProps) {
  if (findQuery.trim().length === 0) {
    return "찾을 내용을 입력해 주세요";
  }

  if (findQuery.trim() !== committedFindQuery.trim()) {
    return "Enter를 눌러 검색하세요";
  }

  return `${findMatches.length === 0 ? 0 : findMatchIndex + 1}/${findMatches.length}`;
}

function FindActions({ closeFindBar, findMatches, findQuery, committedFindQuery, searchFind }: EditorWorkspaceProps) {
  const isUncommitted = findQuery.trim().length > 0 && findQuery.trim() !== committedFindQuery.trim();
  const isDisabled = !isUncommitted && findMatches.length === 0;

  return (
    <div className="note-find-actions">
      <button className="paper-button" type="button" data-testid="note-find-prev-button" aria-label="이전 결과로 이동" disabled={isDisabled} onClick={() => searchFind(-1)}>
        이전
      </button>
      <button className="paper-button" type="button" data-testid="note-find-next-button" aria-label="다음 결과로 이동" disabled={isDisabled} onClick={() => searchFind(1)}>
        다음
      </button>
      <button className="paper-button" type="button" data-testid="note-find-close-button" onClick={() => closeFindBar()}>
        닫기
      </button>
    </div>
  );
}

function AiPromptSlot(props: EditorWorkspaceProps) {
  if (!props.isAiPromptOpen) {
    return null;
  }

  return <AiPromptPanel {...props} />;
}

function AiPromptPanel(props: EditorWorkspaceProps) {
  return (
    <div className="ai-prompt-shell">
      <PromptTemplatePanel {...props} />
      <AiPromptForm {...props} />
      <AiPromptActions {...props} />
      {props.activeTransformFeedback ? <TransformFeedbackBanner feedback={props.activeTransformFeedback} /> : null}
    </div>
  );
}

function PromptTemplatePanel(props: EditorWorkspaceProps) {
  return (
    <div className="ai-template-panel" data-testid="ai-template-panel">
      <div className="ai-template-panel__header">
        <strong>프롬프트 템플릿</strong>
        <button className="paper-button" type="button" data-testid="save-prompt-template-button" disabled={props.isTransformPreviewGenerating || !props.activeAiPrompt.trim()} onClick={() => props.openPromptTemplateEditor()}>
          현재 프롬프트 저장
        </button>
      </div>
      <PromptTemplateList {...props} />
      {props.promptTemplateEditor.isOpen ? <PromptTemplateEditor {...props} /> : null}
    </div>
  );
}

function PromptTemplateList(props: EditorWorkspaceProps) {
  if (props.promptTemplates.length === 0) {
    return <p className="ai-template-empty">자주 쓰는 AI 프롬프트를 저장해 두세요.</p>;
  }

  return (
    <div className="ai-template-list" data-testid="ai-template-list">
      {props.promptTemplates.map((template) => <PromptTemplateItem key={template.id} template={template} {...props} />)}
    </div>
  );
}

function PromptTemplateItem(props: EditorWorkspaceProps & { template: PromptTemplate }) {
  return (
    <div className="ai-template-item">
      <button className="ai-template-chip" type="button" data-testid={`prompt-template-item-${props.template.id}`} disabled={props.isTransformPreviewGenerating} onClick={() => props.applyPromptTemplate(props.template)}>
        {props.template.name}
      </button>
      <div className="ai-template-item__actions">
        <button className="paper-button" type="button" data-testid={`edit-prompt-template-${props.template.id}`} disabled={props.isTransformPreviewGenerating} onClick={() => props.openPromptTemplateEditor(props.template)}>
          수정
        </button>
        <button className="paper-button" type="button" data-testid={`delete-prompt-template-${props.template.id}`} disabled={props.isTransformPreviewGenerating} onClick={() => void props.removePromptTemplate(props.template.id)}>
          삭제
        </button>
      </div>
    </div>
  );
}

function PromptTemplateEditor(props: EditorWorkspaceProps) {
  return (
    <div className="ai-template-editor" data-testid="ai-template-editor">
      <TemplateNameField {...props} />
      <TemplatePromptField {...props} />
      <div className="ai-template-editor__actions">
        <button className="paper-button" type="button" onClick={props.closePromptTemplateEditor}>취소</button>
        <button className="paper-button paper-button-primary" type="button" onClick={() => void props.persistPromptTemplate()}>
          {props.promptTemplateEditor.templateId ? "수정 저장" : "템플릿 저장"}
        </button>
      </div>
    </div>
  );
}

function TemplateNameField(props: EditorWorkspaceProps) {
  return (
    <label className="ai-template-editor__field">
      <span>템플릿 이름</span>
      <input type="text" data-testid="prompt-template-name-input" value={props.promptTemplateEditor.name} disabled={props.isTransformPreviewGenerating} onChange={(event) => updateTemplateField("name", event.target.value, props)} />
    </label>
  );
}

function TemplatePromptField(props: EditorWorkspaceProps) {
  return (
    <label className="ai-template-editor__field">
      <span>템플릿 프롬프트</span>
      <textarea data-testid="prompt-template-prompt-input" value={props.promptTemplateEditor.prompt} disabled={props.isTransformPreviewGenerating} onChange={(event) => updateTemplateField("prompt", event.target.value, props)} />
    </label>
  );
}

function updateTemplateField(field: "name" | "prompt", value: string, { setPromptTemplateEditor }: EditorWorkspaceProps) {
  setPromptTemplateEditor((currentEditor) => ({
    ...currentEditor,
    [field]: value
  }));
}

function AiPromptForm(props: EditorWorkspaceProps) {
  return (
    <form id="ai-prompt-form" className="ai-prompt-form" data-testid="ai-prompt-form" aria-busy={props.isTransformPreviewGenerating} onSubmit={(event) => submitTransform(event, props)}>
      <label className="ai-prompt-input">
        <span className="visually-hidden">AI 정리 프롬프트</span>
        <input ref={props.aiPromptInputRef} type="text" data-testid="ai-prompt-input" value={props.activeAiPrompt} disabled={props.isMutationLocked || props.isTransformPreviewGenerating} placeholder="예: 더 간결하게 요약해줘, 존댓말로 바꿔줘" onChange={(event) => updateAiPrompt(event.target.value, props)} />
      </label>
      <div className="ai-prompt-actions">
        <button className={`paper-button paper-button-primary${props.isTransformPreviewGenerating ? " is-loading" : ""}`} type="submit" data-testid="submit-ai-prompt-button" disabled={props.isMutationLocked || props.isPreviewActionCoolingDown || props.isTransformPreviewGenerating}>
          {props.isTransformPreviewGenerating ? "생성 중…" : props.activeDraft ? "다시 생성" : "미리보기"}
        </button>
      </div>
    </form>
  );
}

function submitTransform(event: FormEvent<HTMLFormElement>, props: EditorWorkspaceProps) {
  event.preventDefault();
  void props.startTransformPreview();
}

function updateAiPrompt(prompt: string, { updateActiveTransformSession }: EditorWorkspaceProps) {
  updateActiveTransformSession((session) => ({
    ...session,
    prompt
  }));
}

function AiPromptActions(props: EditorWorkspaceProps) {
  return (
    <div className="ai-prompt-actions">
      {props.hasBackup && !props.activeDraft ? <RestoreButton {...props} /> : null}
      {props.activeDraft ? <DraftActions {...props} /> : <CancelPromptButton {...props} />}
    </div>
  );
}

function RestoreButton({ isMutationLocked, isTransformPreviewGenerating, restoreOriginal }: EditorWorkspaceProps) {
  return (
    <button className="paper-button transform-restore-button" type="button" data-testid="restore-note-button" disabled={isMutationLocked || isTransformPreviewGenerating} onClick={restoreOriginal}>
      원문 복원
    </button>
  );
}

function DraftActions({ applyTransformDraft, cancelTransformPreview, isMutationLocked, isTransformPreviewGenerating }: EditorWorkspaceProps) {
  return (
    <>
      <button className="paper-button" type="button" data-testid="cancel-transform-button" disabled={isTransformPreviewGenerating} onClick={cancelTransformPreview}>
        취소
      </button>
      <button className="paper-button paper-button-primary" type="button" data-testid="apply-transform-button" disabled={isMutationLocked || isTransformPreviewGenerating} onClick={applyTransformDraft}>
        적용
      </button>
    </>
  );
}

function CancelPromptButton({ closeAiPromptComposer, isTransformPreviewGenerating }: EditorWorkspaceProps) {
  return (
    <button className="paper-button" type="button" data-testid="cancel-ai-prompt-button" disabled={isTransformPreviewGenerating} onClick={closeAiPromptComposer}>
      취소
    </button>
  );
}

function TransformFeedbackBanner({ feedback }: { feedback: EditorFeedback }) {
  return (
    <div className={`transform-feedback-banner is-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"} data-testid={`transform-${feedback.kind}-banner`}>
      <strong>{feedback.title}</strong>
      <span>{feedback.message}</span>
    </div>
  );
}

function StorageLockBanner({ message }: { message: string }) {
  return (
    <div className="storage-lock-banner" role="alert" data-testid="storage-lock-alert">
      <strong>편집 잠금</strong>
      <span>{message}</span>
    </div>
  );
}

function PaperBody(props: EditorWorkspaceProps) {
  return (
    <div className={`paper-body${props.activeDraft ? " is-preview-mode" : ""}`}>
      <PaperBodyContent {...props} />
    </div>
  );
}

function PaperBodyContent(props: EditorWorkspaceProps) {
  if (!props.activeNote) {
    return <EditorEmptyState {...props} />;
  }

  return props.activeDraft ? <TransformReview {...props} /> : <EditableNoteBody {...props} />;
}

function TransformReview(props: EditorWorkspaceProps) {
  return (
    <section className="transform-review-layout" data-testid="transform-preview">
      <PreviewPanel {...props} />
      <OriginalPanel activeNote={props.activeNote} />
    </section>
  );
}

function PreviewPanel(props: EditorWorkspaceProps) {
  return (
    <section className="transform-review-panel transform-review-panel--accent">
      <div className="transform-review-panel-head">
        <PreviewPanelCopy />
        {props.hasBackup ? <PreviewRestoreButton {...props} /> : null}
      </div>
      <pre className="transform-review-body" data-testid="transform-preview-body" tabIndex={0} aria-label="AI가 정리한 미리보기 결과">
        {props.previewDiffSegments.map((segment, index) => <DiffText key={`${index}-${segment.text}`} segment={segment} />)}
      </pre>
    </section>
  );
}

function PreviewPanelCopy() {
  return (
    <div className="transform-review-panel-copy">
      <span className="transform-review-panel-label">제안 결과</span>
      <strong>AI가 정리한 초안이에요</strong>
      <p className="transform-review-panel-note">위 프롬프트를 수정하고 다시 생성하면 아래 초안도 함께 바뀌어요.</p>
    </div>
  );
}

function PreviewRestoreButton({ isMutationLocked, restoreOriginal }: EditorWorkspaceProps) {
  return (
    <button className="paper-button transform-restore-button" type="button" data-testid="restore-note-button" disabled={isMutationLocked} onClick={restoreOriginal}>
      원문으로 복원
    </button>
  );
}

function DiffText({ segment }: { segment: DiffSegment }) {
  return segment.changed ? <span className="transform-review-change">{segment.text}</span> : <span>{segment.text}</span>;
}

function OriginalPanel({ activeNote }: { activeNote: Note | null }) {
  return (
    <aside className="transform-review-panel transform-review-panel--source" data-testid="transform-original-note">
      <div className="transform-review-panel-head">
        <div className="transform-review-panel-copy">
          <span className="transform-review-panel-label">현재 원문</span>
          <strong>적용 전 메모예요</strong>
          <p className="transform-review-panel-note">원문은 읽기 전용 비교 영역으로 그대로 보여드려요.</p>
        </div>
      </div>
      <pre className="transform-review-body transform-review-body--source" data-testid="transform-original-body" tabIndex={0} aria-label="현재 메모 원문">
        {activeNote?.body ?? ""}
      </pre>
    </aside>
  );
}

function EditableNoteBody(props: EditorWorkspaceProps) {
  return (
    <div className="editor-card">
      <label className="editor-field editor-field-body">
        <textarea className="paper-editor" data-testid="note-body-input" ref={props.noteBodyInputRef} value={props.activeNote?.body ?? ""} placeholder="여기에 메모를 적어 주세요." disabled={props.isEditorLocked} readOnly={props.isEditorLocked} onChange={(event) => patchEditorBody(event.target.value, props)} />
      </label>
    </div>
  );
}

function patchEditorBody(body: string, props: EditorWorkspaceProps) {
  props.patchActiveNote(
    {
      body,
      mode: props.hasBackup && props.activeNote ? props.activeNote.mode : "default"
    },
    "메모 내용을 수정했어요."
  );
}

function EditorEmptyState(props: EditorWorkspaceProps) {
  return (
    <section className="editor-empty" data-testid="editor-empty-state">
      <strong>{getEditorEmptyTitle(props)}</strong>
      <p>{getEditorEmptyText(props)}</p>
      {!props.isSidebarOpen ? <EmptyActions {...props} /> : null}
    </section>
  );
}

function getEditorEmptyTitle({ activeNote, hasQuery, isCollectionEmpty, sidebarView }: EditorWorkspaceProps) {
  if (isCollectionEmpty) return "메모가 없어요";
  if (sidebarView === "favorites" && !hasQuery && !activeNote) return "즐겨찾기 메모가 없어요";
  return "선택한 메모가 없어요";
}

function getEditorEmptyText({ activeNote, hasQuery, isCollectionEmpty, sidebarView }: EditorWorkspaceProps) {
  if (isCollectionEmpty) return "새 메모를 만들면 바로 시작할 수 있어요.";
  if (sidebarView === "favorites" && !hasQuery && !activeNote) return "메모 오른쪽 위 별 버튼을 누르면 즐겨찾기만 따로 모아볼 수 있어요.";
  return "왼쪽 목록에서 메모를 선택하거나 새 메모를 만들어 주세요.";
}

function EmptyActions({ emptyCreateButtonRef, handleCreateNote, isMutationLocked, openSidebar }: EditorWorkspaceProps) {
  return (
    <div className="empty-actions">
      <button className="paper-button" type="button" data-testid="empty-open-sidebar-button" onClick={openSidebar}>
        목록 열기
      </button>
      <button className="paper-button" type="button" data-testid="empty-create-note-button" ref={emptyCreateButtonRef} disabled={isMutationLocked} onClick={() => void handleCreateNote()}>
        새 메모
      </button>
    </div>
  );
}
