type DeleteConfirmModalProps = {
  deleteTargetHeadline: string;
  isMutationLocked: boolean;
  cancelDeleteNote: () => void;
  confirmDeleteNote: () => void;
};

export function DeleteConfirmModal({
  deleteTargetHeadline,
  isMutationLocked,
  cancelDeleteNote,
  confirmDeleteNote
}: DeleteConfirmModalProps) {
  return (
    <div className="delete-modal-backdrop" data-testid="delete-confirm-modal" onClick={cancelDeleteNote}>
      <section className="delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-description" onClick={stopPropagation}>
        <h2 id="delete-modal-title">메모를 삭제할까요?</h2>
        <p id="delete-modal-description">"{deleteTargetHeadline}" 메모를 삭제하면 되돌리기 전까지 사라집니다.</p>
        <div className="delete-modal-actions">
          <button className="paper-button" type="button" data-testid="cancel-delete-button" onClick={cancelDeleteNote}>
            취소
          </button>
          <button className="paper-button paper-button-danger" type="button" data-testid="confirm-delete-button" disabled={isMutationLocked} onClick={confirmDeleteNote}>
            정말 삭제
          </button>
        </div>
      </section>
    </div>
  );
}

function stopPropagation(event: MouseEvent) {
  event.stopPropagation();
}
import type { MouseEvent } from "react";
