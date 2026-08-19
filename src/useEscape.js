import { useEffect } from "react";

// Close overlays with the Escape key — standard keyboard affordance the
// backdrop-click sheets were missing. Pass the sheet's onClose.
export function useEscape(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

// Keep keyboard focus inside `containerRef` while the sheet is open. On mount,
// the first focusable descendant is focused; Tab / Shift+Tab wrap at the ends;
// on unmount, focus returns to whatever had it before the sheet opened. Pair
// this with useEscape for a proper modal.
const FOCUSABLE_SEL = [
  "a[href]", "button:not([disabled])", "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])", "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useFocusTrap(containerRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement;

    // Focus the first focusable child (or the container itself as a last resort
    // so screen readers announce the sheet's title, not the page underneath).
    const focusables = () => Array.from(container.querySelectorAll(FOCUSABLE_SEL));
    const list = focusables();
    if (list.length) list[0].focus();
    else { container.setAttribute("tabindex", "-1"); container.focus(); }

    const handler = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      // If focus somehow escaped the sheet (edge case), snap it back.
      if (!container.contains(document.activeElement)) {
        e.preventDefault(); first.focus(); return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    container.addEventListener("keydown", handler);
    return () => {
      container.removeEventListener("keydown", handler);
      // Return focus to whatever opened the sheet so keyboard users don't
      // land on <body>.
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [containerRef]);
}
