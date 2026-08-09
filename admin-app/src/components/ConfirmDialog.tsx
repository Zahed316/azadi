import { useState, useCallback, useEffect, useRef } from 'react';

interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  }, [confirmState]);

  // Close on Escape key + focus trap
  useEffect(() => {
    if (!confirmState) return;
    // Auto-focus Cancel button on open
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
      // Focus trap: Tab cycles between the two buttons
      if (e.key === 'Tab') {
        const dialog = document.querySelector('.confirm-dialog');
        const buttons = dialog?.querySelectorAll('button');
        if (buttons && buttons.length === 2) {
          const first = buttons[0];
          const last = buttons[1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmState, handleCancel, handleConfirm]);

  const ConfirmModal = confirmState ? (
    <div className="confirm-backdrop" onClick={handleCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="confirm-message" className="confirm-message">{confirmState.message}</p>
        <div className="confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-btn confirm-btn-cancel"
            onClick={handleCancel}
          >
            انصراف
          </button>
          <button type="button" className="confirm-btn confirm-btn-ok" onClick={handleConfirm}>
            تایید
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmModal };
}
