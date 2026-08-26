"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      expand={false}
      visibleToasts={4}
      closeButton
      richColors={false}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "!bg-surface !text-foreground !border-border !rounded-xl !shadow-lg",
          title: "!font-medium !text-foreground",
          description: "!text-muted-foreground",

          actionButton:
            "!bg-primary !text-primary-foreground !rounded-lg !font-medium",

          cancelButton:
            "!bg-muted !text-foreground !rounded-lg",

          closeButton:
            "!bg-surface-2 !border-border !text-muted-foreground hover:!text-foreground",

          success: "!border-l-2 !border-l-success",
          error: "!border-l-2 !border-l-danger",
          warning: "!border-l-2 !border-l-warning",
          info: "!border-l-2 !border-l-primary",
        },
      }}
    />
  );
}