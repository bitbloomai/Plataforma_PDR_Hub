"use client";

/* =========================================================
   RÉPLICAS DAS TELAS DO PDR HUB
   Reproduzem o layout real do painel com dados fictícios.
   Cada tela é desenhada em 1280px e escalada para caber no
   container, como se fosse um print em alta resolução.

   Para trocar por prints reais, passe `src` para <ScreenShot>:
   <ScreenShot src="/landing/dashboard.png" alt="Dashboard" />
   ========================================================= */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  Filter,
  Gauge,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";

const BASE_WIDTH = 1280;

const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }).format(value);

/* ---------------------------------------------------------
   Escala
   --------------------------------------------------------- */

function Scaled({ height, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / BASE_WIDTH);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: height * scale }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: BASE_WIDTH, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScreenShot({ screen = "dashboard", src, alt = "Tela do PDR Hub", height = 800, className = "" }) {
  const Screen = SCREENS[screen] || DashboardScreen;

  return (
    <div className={`overflow-hidden rounded-[14px] border border-black/[0.08] bg-surface shadow-[0_1px_0_rgba(0,0,0,0.04),0_30px_80px_-20px_rgba(23,23,21,0.28)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-black/[0.06] bg-[#fbfbfa] px-3.5">
        <span className="size-2.5 rounded-full bg-[#e2e2dd]" />
        <span className="size-2.5 rounded-full bg-[#e2e2dd]" />
        <span className="size-2.5 rounded-full bg-[#e2e2dd]" />
        <span className="mx-auto hidden h-[18px] w-56 items-center justify-center rounded-md bg-black/[0.04] text-[10px] text-muted-foreground sm:flex">
          app.pdrhub.com/panel
        </span>
      </div>

      {src ? (
        <Image src={src} alt={alt} width={BASE_WIDTH} height={height} className="h-auto w-full" />
      ) : (
        <Scaled height={height}>
          <AppShell active={screen}>
            <Screen />
          </AppShell>
        </Scaled>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Shell (sidebar + header)
   --------------------------------------------------------- */

const NAV = [
  ["dashboard", "Dashboard", Gauge],
  ["servicos", "Serviços", ClipboardList],
  ["oficinas", "Oficinas", Building2],
  ["tecnicos", "Técnicos", Wrench],
  ["veiculos", "Veículos", Car],
  ["financeiro", "Financeiro", CircleDollarSign],
  ["dre", "DRE", ReceiptText],
  ["auditoria", "Auditoria", ShieldCheck],
  ["usuarios", "Usuários", Users],
  ["configuracoes", "Configurações", Settings],
];

const TITLES = {
  dashboard: "Dashboard",
  servicos: "Serviços",
  tecnicos: "Técnicos",
  financeiro: "Financeiro",
  dre: "DRE",
};

function AppShell({ active, children }) {
  return (
    <div className="flex h-full w-full bg-[#f7f7f5] text-foreground">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-[72px] items-center border-b border-border px-5">
          <Image src="/Logo_Completa.png" alt="" width={130} height={50} className="h-11 w-auto" />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(([key, label, Icon]) => {
            const on = key === active;
            return (
              <div
                key={key}
                className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium ${
                  on ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                }`}
              >
                {on && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" />}
                <Icon className="size-[18px]" strokeWidth={1.8} />
                {label}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground">
            <Plus className="size-4" strokeWidth={2} />
            Novo serviço
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border bg-surface px-7">
          <h1 className="text-lg font-semibold tracking-tight">{TITLES[active] || "Painel"}</h1>
          <div className="ml-auto flex h-9 w-72 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-xs text-muted-foreground">
            <Search className="size-4" strokeWidth={1.8} />
            Buscar placa, oficina, técnico...
          </div>
          <span className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground">
            <Moon className="size-4" strokeWidth={1.8} />
          </span>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-[#171715] text-xs font-semibold text-white">
              MF
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-medium">Marco Ferreira</p>
              <p className="text-[11px] text-muted-foreground">Administrador</p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-7">{children}</main>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={`relative overflow-hidden rounded-xl border border-border bg-surface ${className}`}>
      <span className="pointer-events-none absolute inset-x-8 top-[-1px] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      {children}
    </section>
  );
}

function FilterPill({ children }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-foreground">
      {children}
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </span>
  );
}

const STATUS = {
  agendado: ["Agendado", "bg-warning/10 text-warning", "bg-warning"],
  em_andamento: ["Em andamento", "bg-[#3b82f6]/10 text-[#2563eb]", "bg-[#3b82f6]"],
  concluido: ["Concluído", "bg-success/10 text-success", "bg-success"],
  pendente: ["Pendente", "bg-warning/10 text-warning", "bg-warning"],
  liquidado: ["Liquidado", "bg-success/10 text-success", "bg-success"],
};

function Status({ value }) {
  const [label, cls, dot] = STATUS[value];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Avatar({ name, tone = "#171715" }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <span
      className="grid size-7 place-items-center rounded-full border-2 border-surface text-[10px] font-semibold text-white"
      style={{ background: tone }}
    >
      {initials}
    </span>
  );
}

/* ---------------------------------------------------------
   Dashboard
   --------------------------------------------------------- */

const CHART = [
  [8, 4], [12, 6], [10, 7], [16, 8], [15, 7], [21, 10], [19, 11],
  [24, 12], [22, 10], [28, 13], [27, 14], [33, 15],
];

function AreaChart() {
  const w = 720;
  const h = 230;
  const pad = 28;
  const max = 36;
  const x = (i) => pad + (i * (w - pad * 2)) / (CHART.length - 1);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);

  const curve = (pts) =>
    pts.reduce((path, p, i) => {
      if (!i) return `M ${p[0]} ${p[1]}`;
      const prev = pts[i - 1];
      const cx = (prev[0] + p[0]) / 2;
      return `${path} C ${cx} ${prev[1]}, ${cx} ${p[1]}, ${p[0]} ${p[1]}`;
    }, "");

  const rev = CHART.map(([r], i) => [x(i), y(r)]);
  const exp = CHART.map(([, d], i) => [x(i), y(d)]);
  const area = (pts) => `${curve(pts)} L ${pts.at(-1)[0]} ${h - pad} L ${pts[0][0]} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[230px] w-full">
      <defs>
        <linearGradient id="lp-rev" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lp-exp" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((r) => (
        <line key={r} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * r} y2={pad + (h - pad * 2) * r} stroke="var(--border)" strokeDasharray="3 5" />
      ))}
      <path d={area(rev)} fill="url(#lp-rev)" />
      <path d={area(exp)} fill="url(#lp-exp)" />
      <path d={curve(rev)} fill="none" stroke="var(--primary)" strokeWidth="2.5" className="lp-draw" />
      <path d={curve(exp)} fill="none" stroke="var(--danger)" strokeWidth="2" strokeOpacity="0.7" className="lp-draw" />
      {rev.map(([cx, cy], i) =>
        i === rev.length - 1 ? (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill="var(--primary)" opacity="0.2" />
            <circle cx={cx} cy={cy} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
          </g>
        ) : null
      )}
    </svg>
  );
}

function Metric({ label, value, caption, icon: Icon, tone }) {
  const toneClass = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    danger: "text-danger bg-danger/10",
  }[tone] || "text-foreground bg-primary/10";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-[22px] font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>
        </div>
        <span className={`grid size-9 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-[18px]" strokeWidth={1.8} />
        </span>
      </div>
    </Card>
  );
}

function DashboardScreen() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FilterPill>
          <CalendarDays className="size-3.5 text-muted-foreground" />
          Este mês
        </FilterPill>
        <FilterPill>Todas as oficinas</FilterPill>
        <FilterPill>Todos os técnicos</FilterPill>
        <span className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium">
          <Download className="size-3.5" />
          Exportar
        </span>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Metric label="Receita prevista" value={money(48920)} caption="Receitas por competência" icon={TrendingUp} />
        <Metric label="Recebido" value={money(36410)} caption="Receitas já liquidadas" icon={ArrowDownLeft} tone="success" />
        <Metric label="A receber" value={money(12510)} caption="Receitas ainda pendentes" icon={WalletCards} tone="warning" />
        <Metric label="Resultado previsto" value={money(21380)} caption="Previsto menos despesas" icon={BarChart3} tone="success" />
        <Metric label="Saldo realizado" value={money(15904)} caption="Recebido menos pago" icon={CircleDollarSign} />
      </div>

      <div className="grid grid-cols-[1.7fr_1fr] gap-3">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Receitas x despesas</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Evolução diária do período</p>
            </div>
            <div className="flex gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Receita</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" />Despesa</span>
            </div>
          </div>
          <AreaChart />
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold">Ranking de oficinas</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Por faturamento no período</p>
          <div className="mt-5 space-y-4">
            {[
              ["Carrozzeria Rossi", 14200, 100],
              ["Autofficina Bianchi", 11350, 80],
              ["Carrozzeria Milano Sud", 9870, 69],
              ["Garage Conti", 7120, 50],
              ["Officina Gallo", 6380, 45],
            ].map(([name, value, pct], i) => (
              <div key={name}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-3 text-muted-foreground">{i + 1}</span>
                    {name}
                  </span>
                  <span className="font-medium">{money(value)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="text-sm font-semibold">Últimos serviços</h3>
          <span className="text-[11px] text-muted-foreground">Ver todos</span>
        </div>
        <ServiceRows compact />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   Serviços
   --------------------------------------------------------- */

const SERVICES = [
  ["GE482KT", "Fiat 500X", "Carrozzeria Rossi", ["Lucas Andrade", "Rafael Souza"], 1250, "concluido", "14/10"],
  ["FN907LS", "Volkswagen Golf", "Autofficina Bianchi", ["Diego Martins"], 780, "em_andamento", "14/10"],
  ["EZ113PR", "Audi A3 Sportback", "Carrozzeria Milano Sud", ["Lucas Andrade"], 2140, "concluido", "13/10"],
  ["GB250MX", "BMW Série 1", "Garage Conti", ["Thiago Lima", "Diego Martins"], 1680, "agendado", "16/10"],
  ["FR641ZA", "Jeep Renegade", "Officina Gallo", ["Rafael Souza"], 940, "concluido", "12/10"],
  ["GD338HT", "Toyota Yaris", "Carrozzeria Rossi", ["Thiago Lima"], 610, "agendado", "17/10"],
];

const TONES = ["#171715", "#b8860b", "#525249", "#8a6d10"];

function ServiceRows({ compact = false }) {
  const rows = compact ? SERVICES.slice(0, 4) : SERVICES;
  return (
    <table className="mt-3 w-full text-left text-xs">
      <thead>
        <tr className="border-y border-border bg-surface-2/50 text-[11px] text-muted-foreground">
          <th className="px-5 py-2.5 font-medium">{compact ? "Data" : "Serviço"}</th>
          <th className="px-5 py-2.5 font-medium">Oficina</th>
          <th className="px-5 py-2.5 font-medium">Técnicos</th>
          {!compact && <th className="px-5 py-2.5 font-medium">Financeiro</th>}
          <th className="px-5 py-2.5 text-right font-medium">Valor</th>
          <th className="px-5 py-2.5 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([plate, car, shop, techs, value, status, date]) => (
          <tr key={plate} className="border-b border-border last:border-0">
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] font-semibold tracking-wider">
                  {plate}
                </span>
                <div>
                  <p className="font-medium">{car}</p>
                  <p className="text-[11px] text-muted-foreground">{date}/2026</p>
                </div>
              </div>
            </td>
            <td className="px-5 py-3">{shop}</td>
            <td className="px-5 py-3">
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {techs.map((t, i) => (
                    <Avatar key={t} name={t} tone={TONES[(i + plate.charCodeAt(1)) % TONES.length]} />
                  ))}
                </div>
                <span className="ml-2 text-muted-foreground">{techs[0].split(" ")[0]}{techs.length > 1 ? ` +${techs.length - 1}` : ""}</span>
              </div>
            </td>
            {!compact && (
              <td className="px-5 py-3">
                <span className="text-muted-foreground">{status === "concluido" ? "3 lançamentos" : "2 lançamentos"}</span>
              </td>
            )}
            <td className="px-5 py-3 text-right font-medium">{money(value)}</td>
            <td className="px-5 py-3 text-right">
              <Status value={status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ServicosScreen() {
  const tabs = [
    ["Todos", "Visão completa", 128, true],
    ["Agendados", "Na fila", 14],
    ["Em andamento", "Na bancada", 9],
    ["Concluídos", "Entregues", 101],
    ["Cancelados", "Sem financeiro", 4],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        {tabs.map(([label, caption, count, on]) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${on ? "border-primary bg-primary/[0.06]" : "border-border bg-surface"}`}
          >
            <p className="text-2xl font-semibold tracking-tight">{count}</p>
            <p className="mt-3 text-[13px] font-semibold">{label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-9 w-80 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted-foreground">
          <Search className="size-3.5" />
          Placa, chassi, oficina...
        </div>
        <FilterPill>Este mês</FilterPill>
        <FilterPill>
          <Filter className="size-3.5 text-muted-foreground" />
          Filtros
        </FilterPill>
        <span className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold">
          <Plus className="size-4" />
          Novo serviço
        </span>
      </div>

      <Card>
        <ServiceRows />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   Técnicos
   --------------------------------------------------------- */

function TecnicosScreen() {
  const techs = [
    ["Lucas Andrade", "Martelinho · Granizo", 42, 8640, "Itália"],
    ["Rafael Souza", "Martelinho · Polimento", 37, 7210, "Itália"],
    ["Diego Martins", "Martelinho", 29, 5980, "Brasil"],
    ["Thiago Lima", "Granizo", 24, 4870, "Portugal"],
    ["Bruno Carvalho", "Martelinho · Pintura", 19, 3920, "Itália"],
    ["Felipe Rocha", "Martelinho", 15, 3110, "Itália"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-80 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs text-muted-foreground">
          <Search className="size-3.5" />
          Buscar técnico
        </div>
        <FilterPill>Ativos</FilterPill>
        <span className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold">
          <Plus className="size-4" />
          Novo técnico
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {techs.map(([name, spec, jobs, payout, country], i) => (
          <Card key={name} className="p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid size-12 place-items-center rounded-xl text-sm font-semibold text-white"
                style={{ background: TONES[i % TONES.length] }}
              >
                {name.split(" ").map((p) => p[0]).join("")}
              </span>
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-[11px] text-muted-foreground">{spec}</p>
              </div>
              <span className="ml-auto size-2 rounded-full bg-success" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-[11px]">
              <div>
                <p className="text-muted-foreground">Serviços</p>
                <p className="mt-1 text-sm font-semibold">{jobs}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Repasses</p>
                <p className="mt-1 text-sm font-semibold">{money(payout)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">País</p>
                <p className="mt-1 text-sm font-semibold">{country}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Financeiro
   --------------------------------------------------------- */

function FinanceiroScreen() {
  const rows = [
    ["receita", "Serviço · GE482KT · Carrozzeria Rossi", "Serviço", 1250, "pendente", "13/11"],
    ["despesa", "Repasse · Lucas Andrade · GE482KT", "Repasse técnico", 375, "pendente", "13/11"],
    ["despesa", "Repasse · Rafael Souza · GE482KT", "Repasse técnico", 312.5, "pendente", "13/11"],
    ["receita", "Serviço · EZ113PR · Carrozzeria Milano Sud", "Serviço", 2140, "liquidado", "12/11"],
    ["despesa", "Repasse · Lucas Andrade · EZ113PR", "Repasse técnico", 642, "liquidado", "12/11"],
    ["despesa", "Aluguel do galpão", "Manual", 1800, "liquidado", "05/10"],
    ["receita", "Serviço · FR641ZA · Officina Gallo", "Serviço", 940, "liquidado", "11/11"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Entradas realizadas", 36410, "text-success", ArrowDownLeft],
          ["Saídas realizadas", 20506, "text-danger", ArrowUpRight],
          ["Saldo realizado", 15904, "text-foreground", CircleDollarSign],
        ].map(([label, value, cls, Icon]) => (
          <Card key={label} className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1.5 text-2xl font-semibold tracking-tight ${cls}`}>{money(value)}</p>
            </div>
            <Icon className={`size-6 ${cls}`} strokeWidth={1.6} />
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <FilterPill>Receitas e despesas</FilterPill>
        <FilterPill>Somente pendentes</FilterPill>
        <FilterPill>Todas as categorias</FilterPill>
        <span className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold">
          <Plus className="size-4" />
          Lançamento
        </span>
      </div>

      <Card>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-[11px] text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Descrição</th>
              <th className="px-5 py-2.5 font-medium">Origem</th>
              <th className="px-5 py-2.5 font-medium">Vencimento</th>
              <th className="px-5 py-2.5 text-right font-medium">Valor</th>
              <th className="px-5 py-2.5 text-right font-medium">Status</th>
              <th className="px-5 py-2.5 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map(([type, desc, origin, value, status, due], i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-7 place-items-center rounded-lg ${
                        type === "receita" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      }`}
                    >
                      {type === "receita" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                    </span>
                    <span className="font-medium">{desc}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{origin}</td>
                <td className="px-5 py-3 text-muted-foreground">{due}/2026</td>
                <td className={`px-5 py-3 text-right font-semibold ${type === "receita" ? "text-success" : "text-danger"}`}>
                  {type === "receita" ? "+" : "−"} {money(value)}
                </td>
                <td className="px-5 py-3 text-right">
                  <Status value={status} />
                </td>
                <td className="px-5 py-3 text-right">
                  {status === "pendente" ? (
                    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] font-medium">
                      <Check className="size-3" />
                      Liquidar
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Reabrir</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   DRE
   --------------------------------------------------------- */

function DreScreen() {
  const lines = [
    ["Receita bruta de serviços", 48920, 41230, 18.7, "head"],
    ["(−) Repasses a técnicos", -17140, -14980, 14.4],
    ["(=) Margem de contribuição", 31780, 26250, 21.1, "sub"],
    ["(−) Despesas operacionais", -6240, -6010, 3.8],
    ["(−) Despesas administrativas", -2860, -2900, -1.4],
    ["(−) Impostos e taxas", -1300, -1120, 16.1],
    ["(=) Resultado líquido", 21380, 16220, 31.8, "total"],
  ];

  return (
    <div className="grid grid-cols-[1fr_300px] gap-4">
      <Card>
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="text-sm font-semibold">Demonstração do resultado</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Outubro 2026 comparado a setembro</p>
          </div>
          <FilterPill>Este mês</FilterPill>
        </div>
        <div className="grid grid-cols-[1fr_130px_130px_100px] border-y border-border bg-surface-2/50 px-6 py-2.5 text-[11px] text-muted-foreground">
          <span>Conta</span>
          <span className="text-right">Período</span>
          <span className="text-right">Anterior</span>
          <span className="text-right">Variação</span>
        </div>
        {lines.map(([label, now, before, delta, kind]) => (
          <div
            key={label}
            className={`grid grid-cols-[1fr_130px_130px_100px] items-center border-b border-border px-6 py-3.5 text-[13px] last:border-0 ${
              kind === "total" ? "bg-primary/[0.08] font-semibold" : kind === "sub" ? "bg-surface-2/40 font-semibold" : ""
            }`}
          >
            <span className={kind ? "" : "pl-4 text-muted-foreground"}>{label}</span>
            <span className="text-right">{money(now)}</span>
            <span className="text-right text-muted-foreground">{money(before)}</span>
            <span className={`text-right text-xs font-medium ${delta >= 0 ? "text-success" : "text-danger"}`}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
            </span>
          </div>
        ))}
      </Card>
      <div className="space-y-3">
        {[
          ["Receitas totais", money(48920)],
          ["Custos + despesas", money(27540)],
          ["Margem líquida", "43,7%"],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          </Card>
        ))}
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Composição dos custos</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            <span className="bg-primary" style={{ width: "62%" }} />
            <span className="bg-[#171715]" style={{ width: "23%" }} />
            <span className="bg-border-strong" style={{ width: "15%" }} />
          </div>
          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary" />Repasses 62%</p>
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#171715]" />Operacional 23%</p>
            <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-border-strong" />Admin + impostos 15%</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

const SCREENS = {
  dashboard: DashboardScreen,
  servicos: ServicosScreen,
  tecnicos: TecnicosScreen,
  financeiro: FinanceiroScreen,
  dre: DreScreen,
};
