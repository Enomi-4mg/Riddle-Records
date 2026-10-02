import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useDismissable } from "../hooks/useDismissable";

export function panelPosition(anchor: { left: number; top: number; bottom: number }, width: number, height: number, viewport: { width: number; height: number }) {
  const margin = 8, gap = 6;
  const maxHeight = Math.max(0, viewport.height - margin * 2);
  const measuredHeight = Math.min(height, maxHeight);
  const below = anchor.bottom + gap;
  const top = below + measuredHeight <= viewport.height - margin ? below : anchor.top - gap - measuredHeight;
  return { left: Math.max(margin, Math.min(anchor.left, viewport.width - width - margin)), top: Math.max(margin, Math.min(top, viewport.height - measuredHeight - margin)), maxHeight };
}

export function FloatingPanel({ anchor, onClose, className = "", children, preserveSelection = false, point }: { anchor: RefObject<HTMLElement | null>; onClose: () => void; className?: string; children: ReactNode; preserveSelection?: boolean; point?: { left: number; top: number } }) {
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 0 });
  useDismissable(true, onClose, [anchor, panel], anchor);
  useLayoutEffect(() => {
    const place = () => {
      if (!panel.current || !anchor.current) return;
      const box = anchor.current.getBoundingClientRect();
      const target = point ? { left: box.left + point.left, top: box.top + point.top, bottom: box.top + point.top } : box;
      setPosition(panelPosition(target, panel.current.offsetWidth, panel.current.scrollHeight, { width: window.innerWidth, height: window.innerHeight }));
    };
    place();
    if (document.activeElement === anchor.current) panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (panel.current) observer?.observe(panel.current);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); observer?.disconnect(); };
  }, [anchor, point?.left, point?.top]);
  return createPortal(<div ref={panel} className={`floating-panel ${className}`} style={position} role="group" onMouseDown={(event) => { if (preserveSelection) event.preventDefault(); }} onKeyDown={(event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length].focus();
  }}>{children}</div>, document.body);
}
