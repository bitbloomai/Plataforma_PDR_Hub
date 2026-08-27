"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Search, Settings, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/client";

const ME_CACHE_KEY = "panel.me.v1";
const ME_CACHE_TTL = 60_000;

const PAGE_TITLES = [
  ["/panel/servicos", "Servicos"],
  ["/panel/oficinas", "Oficinas"],
  ["/panel/tecnicos", "Tecnicos"],
  ["/panel/veiculos", "Veiculos"],
  ["/panel/financeiro", "Financeiro"],
  ["/panel/dre", "DRE"],
  ["/panel/auditoria", "Auditoria"],
  ["/panel/usuarios", "Usuarios"],
  ["/panel/configuracoes", "Configuracoes"],
  ["/panel/perfil", "Meu perfil"],
  ["/panel/busca", "Busca"],
  ["/panel", "Dashboard"],
];

function getInitials(name) {
  return String(name || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function readCachedMe() {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > ME_CACHE_TTL) return null;
    return parsed.data || null;
  } catch {
    return null;
  }
}

function saveCachedMe(data) {
  try {
    sessionStorage.setItem(
      ME_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Cache de sessao e apenas uma otimizacao.
  }
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const dropdownRef = useRef(null);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [search, setSearch] = useState("");

  const pageTitle = useMemo(() => {
    return (
      PAGE_TITLES.find(([href]) =>
        href === "/panel" ? pathname === href : pathname.startsWith(href)
      )?.[1] || "Painel"
    );
  }, [pathname]);

  useEffect(() => {
    let ignore = false;

    async function loadMe() {
      const cached = readCachedMe();
      if (cached) {
        setMe(cached);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) throw new Error("Falha ao carregar perfil");

        const data = await response.json();
        if (ignore) return;

        setMe(data);
        saveCachedMe(data);
      } catch (error) {
        console.error("Header /api/me", error);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMe();
    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/panel/busca?q=${encodeURIComponent(query)}`);
  }

  async function logout() {
    try {
      sessionStorage.removeItem(ME_CACHE_KEY);
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const avatarUrl = me?.usuario?.foto_url;
  const displayName = me?.usuario?.nome || "Usuario";
  const accountName =
    me?.conta?.nome_fantasia || me?.conta?.nome || me?.configuracao?.nome_sistema || "Conta";

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="relative flex h-20 items-center gap-4 px-4 sm:px-5 lg:px-7">
        <div className="pointer-events-none absolute inset-x-8 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="min-w-0 shrink-0">
          <p className="text-xs font-medium text-muted-foreground md:hidden">Painel</p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
            {pageTitle}
          </h1>
        </div>

        <form
          onSubmit={submitSearch}
          className="mx-auto hidden w-full max-w-xl md:block"
        >
          <label className="group relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-foreground"
              strokeWidth={1.8}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar placa, oficina, tecnico..."
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-16 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Enter
            </span>
          </label>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              className="flex h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 transition hover:border-border hover:bg-surface sm:pr-2.5"
              aria-expanded={profileOpen}
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground">
                {!avatarBroken && avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  getInitials(displayName)
                )}
              </span>

              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-36 truncate text-sm font-medium leading-4 text-foreground">
                  {loading ? "Carregando..." : displayName}
                </span>
                <span className="mt-0.5 block max-w-36 truncate text-[11px] text-muted-foreground">
                  {accountName}
                </span>
              </span>

              <ChevronDown
                className={`hidden size-4 text-muted-foreground transition-transform lg:block ${
                  profileOpen ? "rotate-180" : ""
                }`}
                strokeWidth={1.8}
              />
            </button>

            <div
              className={`absolute right-0 top-[calc(100%+10px)] w-64 origin-top-right rounded-xl border border-border bg-surface p-2 shadow-xl shadow-black/10 transition duration-150 ${
                profileOpen
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-95 opacity-0"
              }`}
            >
              <div className="mb-2 rounded-lg bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface text-xs font-semibold text-foreground">
                    {!avatarBroken && avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setAvatarBroken(true)}
                      />
                    ) : (
                      getInitials(displayName)
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{me?.usuario?.email}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/panel/perfil")}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              >
                <UserRound className="size-4" strokeWidth={1.8} />
                Meu perfil
              </button>

              <button
                type="button"
                onClick={() => router.push("/panel/configuracoes")}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              >
                <Settings className="size-4" strokeWidth={1.8} />
                Configuracoes
              </button>

              <div className="my-2 h-px bg-border" />

              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-danger transition hover:bg-danger/10"
              >
                <LogOut className="size-4" strokeWidth={1.8} />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
