"use client";

import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      {children}

      <ToastProvider />
    </ThemeProvider>
  );
}