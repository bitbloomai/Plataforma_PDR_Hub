"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const SIDEBAR_KEY = "panel.sidebar.collapsed";

export function PanelShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // localStorage indisponível: usa o estado padrão expandido.
    }
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;

      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // Persistência é só conveniência visual.
      }

      return next;
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-5 lg:px-7 lg:pt-6 md:pb-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}