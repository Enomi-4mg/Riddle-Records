import { useEffect, useId, useRef, type ReactNode } from "react";
export function ConfirmationDialog({ title, children, confirmLabel, disabled, danger, onConfirm, onClose }: {
  title: string; children: ReactNode; confirmLabel: string; disabled?: boolean; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { dialog.current?.close(); if (focus?.isConnected) focus.focus(); };
  }, []);
  return <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id={titleId}>{title}</h2>{children}<div className="button-row"><button autoFocus onClick={onClose}>戻る</button><button className={danger ? "danger" : "primary"} disabled={disabled} onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
