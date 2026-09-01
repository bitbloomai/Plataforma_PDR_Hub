"use client";

import { useEffect, useRef, useState } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let scrollLocks = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};

  if (scrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  scrollLocks += 1;

  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
    }
  };
}

export function usePresence(open, duration = 200) {
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame;
    let timeout;

    if (open) {
      frame = requestAnimationFrame(() => {
        setRendered(true);
        frame = requestAnimationFrame(() => setVisible(true));
      });
    } else {
      frame = requestAnimationFrame(() => {
        setVisible(false);
        timeout = window.setTimeout(() => setRendered(false), duration);
      });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (timeout) clearTimeout(timeout);
    };
  }, [duration, open]);

  return { rendered, visible };
}

export function useDialogBehavior({ open, onClose, containerRef, closeOnEscape = true }) {
  const lastFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    lastFocusedRef.current = document.activeElement;
    const unlock = lockBodyScroll();

    const focusFirst = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const focusables = [...container.querySelectorAll(FOCUSABLE)].filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );
      (focusables[0] || container).focus?.();
    }, 0);

    function onKeyDown(event) {
      if (closeOnEscape && event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusables = [...container.querySelectorAll(FOCUSABLE)].filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );

      if (!focusables.length) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusFirst);
      unlock();
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus?.();
    };
  }, [closeOnEscape, containerRef, open]);
}
