"use client";

import { useEffect, useState } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

const SIDEBAR_KEY = "panel.sidebar.collapsed";

export function PanelShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarLoaded, setSidebarLoaded] = useState(false);

  useEffect(() => {
    function updatePanelViewport() {
      document.documentElement.style.setProperty(
        "--panel-viewport-height",
        `${window.innerHeight}px`
      );
    }

    updatePanelViewport();
    window.addEventListener("resize", updatePanelViewport);
    window.addEventListener("orientationchange", updatePanelViewport);

    return () => {
      window.removeEventListener("resize", updatePanelViewport);
      window.removeEventListener("orientationchange", updatePanelViewport);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
      } catch {
        // localStorage indisponivel: usa o estado padrao expandido.
      } finally {
        setSidebarLoaded(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!sidebarLoaded) return;

    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // Persistencia e so conveniencia visual.
    }
  }, [collapsed, sidebarLoaded]);

  function toggleSidebar() {
    setCollapsed((current) => !current);
  }

  return (
    <div className="flex h-[var(--panel-viewport-height,100svh)] overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 lg:px-7 lg:pt-6 md:pb-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
