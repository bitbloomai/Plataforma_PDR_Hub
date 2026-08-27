"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";
import { Portal } from "./Portal";
import { Button } from "./Button";
import { useDialogBehavior, usePresence } from "./overlay-hooks";
import { cn } from "./utils";

const widths = {
  sm: "max-w-xl",
  md: "max-w-3xl lg:max-w-4xl",
  lg: "max-w-5xl xl:max-w-6xl",
  full: "max-w-none",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  maxHeight = "90dvh",
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  showHandle = true,
  className,
  contentClassName,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef(null);
  const { rendered, visible } = usePresence(open, 240);

  useDialogBehavior({
    open,
    onClose,
    containerRef: drawerRef,
    closeOnEscape,
  });

  if (!rendered) return null;

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-[110] flex items-end justify-center",
          "transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Fechar painel"
          tabIndex={-1}
          className="absolute inset-0 cursor-default bg-[var(--overlay)]"
          onClick={() => closeOnOverlay && onClose?.()}
        />

        <section
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          style={{ maxHeight }}
          className={cn(
            "relative z-10 flex w-full flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-surface shadow-2xl outline-none",
            "transition-transform duration-300 ease-out",
            visible ? "translate-y-0" : "translate-y-full",
            widths[size] || widths.md,
            className
          )}
        >
          {showHandle ? (
            <div className="flex justify-center pt-2.5" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-border-strong" />
            </div>
          ) : null}

          {(title || description || showCloseButton) && (
            <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold text-foreground sm:text-lg">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>

              {showCloseButton ? (
                <Button
                  size="iconSm"
                  variant="ghost"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-1 -mt-1"
                >
                  <X className="size-4" strokeWidth={1.9} />
                </Button>
              ) : null}
            </header>
          )}

          <div className={cn("min-h-0 flex-1 overflow-y-auto p-4 sm:p-5", contentClassName)}>
            {children}
          </div>

          {footer ? (
            <footer className="flex flex-col-reverse gap-2 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              {footer}
            </footer>
          ) : null}
        </section>
      </div>
    </Portal>
  );
}
