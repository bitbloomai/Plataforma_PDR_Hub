"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Menu,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from "lucide-react";

const LOGO_FULL = "/Logo_Completa.png";
const LOGO_SHORT = "/Logo_Curta.png";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/panel", icon: Gauge },
  { label: "Serviços", href: "/panel/servicos", icon: ClipboardList },
  { label: "Oficinas", href: "/panel/oficinas", icon: Building2 },
  { label: "Técnicos", href: "/panel/tecnicos", icon: Wrench },
  { label: "Veículos", href: "/panel/veiculos", icon: Car },
  { label: "Financeiro", href: "/panel/financeiro", icon: CircleDollarSign },
  { label: "DRE", href: "/panel/dre", icon: ReceiptText },
  { label: "Auditoria", href: "/panel/auditoria", icon: ShieldCheck },
  { label: "Usuários", href: "/panel/usuarios", icon: Users },
  { label: "Configurações", href: "/panel/configuracoes", icon: Settings },
];

const MOBILE_PRIMARY = [
  { label: "Início", href: "/panel", icon: Gauge },
  { label: "Serviços", href: "/panel/servicos", icon: ClipboardList },
  { label: "Financeiro", href: "/panel/financeiro", icon: CircleDollarSign },
];

function isActivePath(pathname, href) {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandImage({ collapsed }) {
  const [src, setSrc] = useState(collapsed ? LOGO_SHORT : LOGO_FULL);

  useEffect(() => {
    setSrc(collapsed ? LOGO_SHORT : LOGO_FULL);
  }, [collapsed]);

  return (
    <img
      src={src}
      alt="Logo"
      className={collapsed ? "h-12 w-12 object-contain" : "h-12 max-w-50 object-contain"}
      onError={() => setSrc(collapsed ? "/logo.png" : "/logo.png")}
    />
  );
}

export function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <aside
        className={`relative hidden h-dvh shrink-0 border-r border-border bg-surface transition-[width] duration-300 md:flex md:flex-col ${
          collapsed ? "w-[76px]" : "w-[252px]"
        }`}
      >
        <div className="flex h-20 items-center justify-center border-b border-border px-4">
          <Link
            href="/panel"
            className={`flex min-w-0 items-center ${collapsed ? "w-full justify-center" : "justify-start"}`}
            aria-label="Ir para o dashboard"
          >
            <BrandImage collapsed={collapsed} />
          </Link>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="absolute -right-3 top-[66px] z-9999 grid size-7 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition hover:border-primary/60 hover:text-foreground"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" strokeWidth={1.8} />
          ) : (
            <ChevronLeft className="size-4" strokeWidth={1.8} />
          )}
        </button>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex h-11 items-center rounded-lg text-sm font-medium transition-all ${
                    collapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    active
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" />
                  )}

                  <Icon
                    className={`size-5 shrink-0 transition-transform group-hover:scale-105 ${
                      active ? "text-foreground" : ""
                    }`}
                    strokeWidth={1.8}
                  />

                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/panel/servicos?novo=1"
            className={`flex h-11 items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover active:scale-[0.98] ${
              collapsed ? "justify-center px-0" : "justify-center gap-2 px-3"
            }`}
            title={collapsed ? "Novo serviço" : undefined}
          >
            <Plus className="size-5" strokeWidth={2} />
            {!collapsed && <span>Novo serviço</span>}
          </Link>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-1">
          {MOBILE_PRIMARY.slice(0, 2).map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid size-8 place-items-center rounded-lg transition ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <Link
            href="/panel/servicos?novo=1"
            className="group relative -mt-6 flex min-h-16 flex-col items-center justify-end gap-1 text-[11px] font-semibold text-foreground"
            aria-label="Cadastrar novo serviço"
          >
            <span className="absolute top-0 size-[58px] rounded-2xl border border-primary/30 bg-primary/10 animate-pulse" />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition duration-200 group-active:scale-90">
              <Plus className="size-7" strokeWidth={2.2} />
            </span>
            <span className="mt-1">Novo</span>
          </Link>

          {MOBILE_PRIMARY.slice(2).map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`grid size-8 place-items-center rounded-lg transition ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium text-muted-foreground transition active:scale-95"
          >
            <span className="grid size-8 place-items-center rounded-lg">
              <Menu className="size-5" strokeWidth={1.8} />
            </span>
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          moreOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMoreOpen(false)}
        aria-hidden={!moreOpen}
      />

      <section
        className={`fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border border-border bg-surface p-4 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 md:hidden ${
          moreOpen ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!moreOpen}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong" />

        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Mais opções</p>
            <p className="text-xs text-muted-foreground">Acesse todos os módulos</p>
          </div>
          <button
            type="button"
            onClick={() => setMoreOpen(false)}
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
            aria-label="Fechar menu"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {NAV_ITEMS.filter(
            (item) => !["/panel", "/panel/servicos", "/panel/financeiro"].includes(item.href)
          ).map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center text-xs font-medium transition ${
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
