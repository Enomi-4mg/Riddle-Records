import { useEffect, useRef, type RefObject } from "react";

export function useDismissable(open: boolean, onClose: () => void, regions: RefObject<HTMLElement | null>[], returnFocus?: RefObject<HTMLElement | null>) {
  const latest = useRef({ onClose, regions, returnFocus });
  latest.current = { onClose, regions, returnFocus };
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (latest.current.regions.some((ref) => ref.current && event.composedPath().includes(ref.current))) return;
      latest.current.onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      latest.current.onClose();
      latest.current.returnFocus?.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer, true); document.removeEventListener("keydown", key); };
  }, [open]);
}
