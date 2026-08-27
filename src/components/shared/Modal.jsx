"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";
import { Portal } from "./Portal";
import { Button } from "./Button";
import { useDialogBehavior, usePresence } from "./overlay-hooks";
import { cn } from "./utils";

const sizes = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[calc(100vw-2rem)]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
  contentClassName,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const { rendered, visible } = usePresence(open, 180);

  useDialogBehavior({
    open,
    onClose,
    containerRef: dialogRef,
    closeOnEscape,
  });

  if (!rendered) return null;

  return (
    <Portal>
      <div
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5",
          "transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Fechar modal"
          tabIndex={-1}
          className="absolute inset-0 cursor-default bg-[var(--overlay)]"
          onClick={() => closeOnOverlay && onClose?.()}
        />

        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            "relative z-10 flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl outline-none",
            "transition duration-200 ease-out",
            visible ? "scale-100 translate-y-0" : "scale-[0.98] translate-y-2",
            sizes[size] || sizes.md,
            className
          )}
        >
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
