"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  Gauge,
  Plus,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { localISO, todayISO } from "@/lib/dates";
import { formatDateByConfig } from "@/lib/formatters";

const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;
const DATA_CACHE_TTL = 30_000;
const OPTIONS_CACHE_TTL = 5 * 60_000;
const dashboardCache = new Map();

function getPresetRange(preset, timezone) {
  const today = new Date(`${todayISO(timezone)}T12:00:00`);

  if (preset === "today") {
    return { from: localISO(today), to: localISO(today) };
  }

  if (preset === "week") {
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);
    return { from: localISO(monday), to: localISO(today) };
  }

  if (preset === "previous_month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localISO(first), to: localISO(last) };
  }

  if (preset === "year") {
    return {
      from: `${today.getFullYear()}-01-01`,
      to: localISO(today),
    };
  }

  return {
    from: localISO(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localISO(today),
  };
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function sumBy(rows, selector) {
  return rows.reduce((total, row) => total + safeNumber(selector(row)), 0);
}

function isPaid(status) {
  return ["pago", "recebido", "paid"].includes(String(status || "").toLowerCase());
}

function isRevenue(row) {
  return String(row?.tipo || "").toLowerCase() === "receita";
}

function isExpense(row) {
  return String(row?.tipo || "").toLowerCase() === "despesa";
}

function dateDiffInDays(from, to) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  return Math.max(0, Math.round((end - start) / 86400000));
}

function mondayOf(date) {
  const clone = new Date(date);
  const offset = (clone.getDay() + 6) % 7;
  clone.setDate(clone.getDate() - offset);
  return clone;
}

function bucketKey(dateString, mode) {
  const date = new Date(`${dateString}T12:00:00`);

  if (mode === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (mode === "week") return localISO(mondayOf(date));
  return localISO(date);
}

function bucketLabel(key, mode, config) {
  if (mode === "month") {
    const [year, month] = key.split("-");
    return new Intl.DateTimeFormat(config?.locale || "it-IT", { month: "short", year: "2-digit" }).format(
      new Date(Number(year), Number(month) - 1, 1)
    );
  }

  if (mode === "week") {
    return `Sem ${formatDateByConfig(key, config)}`;
  }

  return formatDateByConfig(key, config);
}

function nextBucketKey(key, mode) {
  if (mode === "month") {
    const [year, month] = key.split("-").map(Number);
    return localISO(new Date(year, month, 1)).slice(0, 7);
  }

  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + (mode === "week" ? 7 : 1));
  return bucketKey(localISO(date), mode);
}

function buildTimeSeries(services, movements, from, to, config) {
  const days = dateDiffInDays(from, to);
  const mode = days > 180 ? "month" : days > 45 ? "week" : "day";
  const map = new Map();
  const startKey = bucketKey(from, mode);
  const endKey = bucketKey(to, mode);

  for (let key = startKey; key <= endKey; key = nextBucketKey(key, mode)) {
    map.set(key, { key, faturamento: 0, receita: 0, despesa: 0 });
  }

  for (const service of services) {
    const key = bucketKey(service.data_servico, mode);
    const current = map.get(key) || { key, faturamento: 0, receita: 0, despesa: 0 };
    current.faturamento += safeNumber(service.valor);
    map.set(key, current);
  }

  for (const movement of movements) {
    const key = bucketKey(movement.data_competencia, mode);
    const current = map.get(key) || { key, faturamento: 0, receita: 0, despesa: 0 };
    if (isRevenue(movement)) current.receita += safeNumber(movement.valor);
    if (isExpense(movement)) current.despesa += safeNumber(movement.valor);
    map.set(key, current);
  }

  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({ ...item, label: bucketLabel(item.key, mode, config) }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(services, formatMoney) {
  const header = ["Data", "Oficina", "Placa", "Veículo", "Técnicos", "Valor"];
  const rows = services.map((service) => {
    const techs = (service.servicos_tecnicos || [])
      .map((link) => link.tecnico?.nome)
      .filter(Boolean)
      .join(", ");

    const vehicle = [service.veiculo?.marca, service.veiculo?.modelo].filter(Boolean).join(" ");

    return [
      service.data_servico,
      service.oficina?.nome || "",
      service.veiculo?.placa || "",
      vehicle,
      techs,
      formatMoney(service.valor),
    ];
  });

  const content = [header, ...rows]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio-servicos-${todayISO()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function fetchMe() {
  try {
    const raw = sessionStorage.getItem("panel.me.v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.savedAt && Date.now() - parsed.savedAt < 60_000 && parsed.data) {
        return parsed.data;
      }
    }
  } catch {
    // Sem cache, segue para a API.
  }

  const response = await fetch("/api/me", { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível identificar o usuário.");
  const data = await response.json();

  try {
    sessionStorage.setItem("panel.me.v1", JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cache é opcional.
  }

  return data;
}

async function fetchPaged(buildQuery) {
  const rows = [];

  for (let start = 0; start < MAX_ROWS; start += PAGE_SIZE) {
    const end = start + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(start, end);
    if (error) throw error;

    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function loadOptions(supabase, contaId, force = false) {
  const key = `options:${contaId}`;
  const cached = dashboardCache.get(key);

  if (!force && cached && Date.now() - cached.savedAt < OPTIONS_CACHE_TTL) {
    return cached.data;
  }

  const [officesResult, techniciansResult] = await Promise.all([
    supabase
      .from("oficinas")
      .select("id, nome, ativo")
      .eq("conta_id", contaId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("tecnicos")
      .select("id, nome, ativo, foto_url")
      .eq("conta_id", contaId)
      .eq("ativo", true)
      .order("nome"),
  ]);

  if (officesResult.error) throw officesResult.error;
  if (techniciansResult.error) throw techniciansResult.error;

  const data = {
    offices: officesResult.data || [],
    technicians: techniciansResult.data || [],
  };

  dashboardCache.set(key, { savedAt: Date.now(), data });
  return data;
}

async function loadDashboardRaw({ supabase, contaId, from, to, officeId, force = false }) {
  const key = `dashboard:${contaId}:${from}:${to}:${officeId || "all"}`;
  const cached = dashboardCache.get(key);

  if (!force && cached && Date.now() - cached.savedAt < DATA_CACHE_TTL) {
    return cached.data;
  }

  const servicesPromise = fetchPaged((start, end) => {
    let query = supabase
      .from("servicos")
      .select(
        `
          id,
          conta_id,
          oficina_id,
          veiculo_id,
          data_servico,
          valor,
          descricao,
          created_at,
          oficina:oficinas(id,nome),
          veiculo:veiculos(id,placa,marca,modelo),
          servicos_tecnicos(
            tecnico_id,
            percentual,
            valor_repasse,
            tecnico:tecnicos(id,nome)
          )
        `
      )
      .eq("conta_id", contaId)
      .gte("data_servico", from)
      .lte("data_servico", to)
      .order("data_servico", { ascending: false })
      .order("created_at", { ascending: false })
      .range(start, end);

    if (officeId) query = query.eq("oficina_id", officeId);
    return query;
  });

  const movementsPromise = fetchPaged((start, end) => {
    let query = supabase
      .from("movimentacoes_financeiras")
      .select(
        `
          id,
          conta_id,
          servico_id,
          tecnico_id,
          oficina_id,
          tipo,
          origem,
          descricao,
          valor,
          status,
          data_competencia,
          data_vencimento,
          data_pagamento,
          created_at,
          oficina:oficinas(id,nome),
          tecnico:tecnicos(id,nome)
        `
      )
      .eq("conta_id", contaId)
      .gte("data_competencia", from)
      .lte("data_competencia", to)
      .order("data_competencia", { ascending: false })
      .order("created_at", { ascending: false })
      .range(start, end);

    if (officeId) query = query.eq("oficina_id", officeId);
    return query;
  });

  const [services, movements] = await Promise.all([servicesPromise, movementsPromise]);
  const data = { services, movements };
  dashboardCache.set(key, { savedAt: Date.now(), data });
  return data;
}

function Card({ children, className = "" }) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-border bg-surface ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-8 top-[-1px] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      {children}
    </section>
  );
}

function EmptyMini({ label = "Sem dados neste período" }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function MetricCard({ label, value, caption, icon: Icon, tone = "primary" }) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "danger"
        ? "text-danger bg-danger/10"
        : tone === "warning"
          ? "text-warning bg-warning/10"
          : "text-foreground bg-primary/10";

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      </div>
    </Card>
  );
}

function LineAreaChart({ data, compactMoney }) {
  if (!data.length) return <EmptyMini />;

  const width = 760;
  const height = 300;
  const pad = { left: 54, right: 24, top: 30, bottom: 48 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(
    ...data.flatMap((item) => [item.faturamento, item.despesa]),
    1
  );
  const x = (index) => pad.left + (index * plotWidth) / Math.max(1, data.length - 1);
  const y = (value) => pad.top + plotHeight - (value / maxValue) * plotHeight;
  const revenuePoints = data.map((item, index) => [x(index), y(item.faturamento)]);
  const expensePoints = data.map((item, index) => [x(index), y(item.despesa)]);
  const bottomY = pad.top + plotHeight;
  const tickIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const totalRevenue = sumBy(data, (item) => item.faturamento);
  const totalExpense = sumBy(data, (item) => item.despesa);
  const result = totalRevenue - totalExpense;

  function curvePath(points) {
    if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point[0]} ${point[1]}`;

      const previous = points[index - 1];
      const controlX = (previous[0] + point[0]) / 2;
      return `${path} C ${controlX} ${previous[1]}, ${controlX} ${point[1]}, ${point[0]} ${point[1]}`;
    }, "");
  }

  function areaPath(points) {
    return `${curvePath(points)} L ${points.at(-1)[0]} ${bottomY} L ${points[0][0]} ${bottomY} Z`;
  }

  const revenuePath = curvePath(revenuePoints);
  const expensePath = curvePath(expensePoints);

  return (
    <div className="w-full">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          ["Faturamento", totalRevenue, "bg-primary"],
          ["Despesas", totalExpense, "bg-danger"],
          ["Resultado", result, result >= 0 ? "bg-success" : "bg-danger"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`size-2 rounded-full ${color}`} />
              {label}
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {compactMoney(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full min-w-[620px]">
          <defs>
            <linearGradient id="revenue-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="expense-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.01" />
            </linearGradient>
          </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const gridY = pad.top + plotHeight * ratio;
          const value = maxValue * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={gridY}
                y2={gridY}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={ratio === 1 ? "0" : "4 6"}
              />
              <text
                x={pad.left - 8}
                y={gridY + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {compactMoney(value)}
              </text>
            </g>
          );
        })}

          <path d={areaPath(revenuePoints)} fill="url(#revenue-area)" />
          <path d={areaPath(expensePoints)} fill="url(#expense-area)" />
          <path
            d={revenuePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={expensePath}
            fill="none"
            stroke="var(--danger)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((item, index) => (
            <g key={item.key}>
              <circle
                cx={x(index)}
                cy={y(item.faturamento)}
                r="3.5"
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth="2"
              />
              <circle
                cx={x(index)}
                cy={y(item.despesa)}
                r="3"
                fill="var(--surface)"
                stroke="var(--danger)"
                strokeWidth="2"
              />
            </g>
          ))}

        {tickIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 12}
            textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {data[index]?.label}
          </text>
        ))}

          <g transform={`translate(${width - 190} 8)`}>
            <circle cx="0" cy="0" r="4" fill="var(--primary)" />
            <text x="10" y="4" fontSize="11" fill="var(--muted-foreground)">
              Faturamento
            </text>
            <circle cx="96" cy="0" r="4" fill="var(--danger)" />
            <text x="106" y="4" fontSize="11" fill="var(--muted-foreground)">
              Despesas
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function RevenueExpenseBars({ data, compactMoney }) {
  if (!data.length) return <EmptyMini />;

  const visible = data.slice(-12);
  const maxValue = Math.max(...visible.flatMap((item) => [item.receita, item.despesa]), 1);

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" /> Receita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger" /> Despesa
        </span>
      </div>

      <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1">
        {visible.map((item) => (
          <div key={item.key} className="flex min-w-12 flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center gap-1">
              <div
                className="w-[38%] rounded-t-md bg-success/75 transition hover:bg-success"
                style={{ height: `${Math.max(3, (item.receita / maxValue) * 100)}%` }}
                title={`Receita: ${compactMoney(item.receita)}`}
              />
              <div
                className="w-[38%] rounded-t-md bg-danger/70 transition hover:bg-danger"
                style={{ height: `${Math.max(3, (item.despesa / maxValue) * 100)}%` }}
                title={`Despesa: ${compactMoney(item.despesa)}`}
              />
            </div>
            <span className="max-w-16 truncate text-[10px] text-muted-foreground">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ranking({ rows, formatMoney, type }) {
  if (!rows.length) return <EmptyMini label="Ainda não há ranking para este filtro." />;

  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-4">
      {rows.slice(0, 6).map((row, index) => (
        <div key={row.id}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                <span className="mr-2 text-xs text-muted-foreground">#{index + 1}</span>
                {row.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.count} {row.count === 1 ? "serviço" : "serviços"}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-foreground">
              {type === "money" ? formatMoney(row.value) : row.value}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FinancialRing({ received, pending, formatMoney }) {
  const total = received + pending;
  const receivedPct = total ? Math.round((received / total) * 100) : 0;

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative grid size-28 shrink-0 place-items-center rounded-full"
        style={{
          background: total
            ? `conic-gradient(var(--success) 0 ${receivedPct}%, var(--warning) ${receivedPct}% 100%)`
            : "var(--surface-2)",
        }}
      >
        <div className="grid size-20 place-items-center rounded-full border border-border bg-surface text-center">
          <div>
            <p className="text-xl font-semibold text-foreground">{receivedPct}%</p>
            <p className="text-[10px] text-muted-foreground">recebido</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success" /> Recebido
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatMoney(received)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-warning" /> Pendente
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatMoney(pending)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 rounded-xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-80 rounded-xl bg-surface-2 xl:col-span-2" />
        <div className="h-80 rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const requestIdRef = useRef(0);
  const meRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  const [me, setMe] = useState(null);
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [officeId, setOfficeId] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  const [offices, setOffices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [rawServices, setRawServices] = useState([]);
  const [rawMovements, setRawMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timezone = me?.configuracao?.timezone || "Europe/Rome";

  const formatMoney = useCallback(
    (value) => {
      const currency = me?.configuracao?.moeda || "EUR";
      const locale = me?.configuracao?.locale || "it-IT";

      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(safeNumber(value));
      } catch {
        return `${currency} ${safeNumber(value).toFixed(2)}`;
      }
    },
    [me]
  );

  const compactMoney = useCallback(
    (value) => {
      const currency = me?.configuracao?.moeda || "EUR";
      const locale = me?.configuracao?.locale || "it-IT";

      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(safeNumber(value));
      } catch {
        return `${currency} ${Math.round(safeNumber(value))}`;
      }
    },
    [me]
  );

  const load = useCallback(
    async ({ force = false } = {}) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError("");

      try {
        const meData = meRef.current || (await fetchMe());
        meRef.current = meData;
        const contaId = meData?.usuario?.conta_id;
        if (!contaId) throw new Error("Usuário sem conta vinculada.");

        const [options, raw] = await Promise.all([
          loadOptions(supabase, contaId, force),
          loadDashboardRaw({
            supabase,
            contaId,
            from,
            to,
            officeId,
            force,
          }),
        ]);

        if (requestId !== requestIdRef.current) return;

        startTransition(() => {
          setMe(meData);
          setOffices(options.offices);
          setTechnicians(options.technicians);
          setRawServices(raw.services);
          setRawMovements(raw.movements);
        });
      } catch (loadError) {
        console.error("Dashboard load", loadError);
        if (requestId === requestIdRef.current) {
          setError(loadError?.message || "Não foi possível carregar o dashboard.");
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [from, officeId, startTransition, supabase, to]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => load());

    return () => cancelAnimationFrame(frameId);
  }, [load]);

  function changePreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const range = getPresetRange(nextPreset, timezone);
    setFrom(range.from);
    setTo(range.to);
  }

  const services = useMemo(() => {
    if (!technicianId) return rawServices;
    return rawServices.filter((service) =>
      (service.servicos_tecnicos || []).some((link) => link.tecnico_id === technicianId)
    );
  }, [rawServices, technicianId]);

  const serviceIds = useMemo(() => new Set(services.map((service) => service.id)), [services]);

  const movements = useMemo(() => {
    if (!technicianId) return rawMovements;
    return rawMovements.filter(
      (movement) =>
        movement.tecnico_id === technicianId ||
        (movement.servico_id && serviceIds.has(movement.servico_id))
    );
  }, [rawMovements, serviceIds, technicianId]);

  const metrics = useMemo(() => {
    const revenues = movements.filter(isRevenue);
    const expenses = movements.filter(isExpense);
    const techTransfers = expenses.filter(
      (movement) => String(movement.origem || "").toLowerCase() === "repasse_tecnico"
    );

    const faturamento = sumBy(services, (service) => service.valor);
    const recebido = sumBy(revenues.filter((movement) => isPaid(movement.status)), (m) => m.valor);
    const aReceber = sumBy(revenues.filter((movement) => !isPaid(movement.status)), (m) => m.valor);
    const despesas = sumBy(expenses, (movement) => movement.valor);
    const receitas = sumBy(revenues, (movement) => movement.valor);
    const repassesPagos = sumBy(
      techTransfers.filter((movement) => isPaid(movement.status)),
      (movement) => movement.valor
    );
    const repassesPendentes = sumBy(
      techTransfers.filter((movement) => !isPaid(movement.status)),
      (movement) => movement.valor
    );

    return {
      faturamento,
      recebido,
      aReceber,
      despesas,
      resultado: receitas - despesas,
      repassesPagos,
      repassesPendentes,
      quantidadeServicos: services.length,
      ticketMedio: services.length ? faturamento / services.length : 0,
      oficinasAtendidas: new Set(services.map((service) => service.oficina_id)).size,
      tecnicosAtivos: technicianId ? 1 : technicians.length,
    };
  }, [movements, services, technicianId, technicians.length]);

  const timeSeries = useMemo(
    () => buildTimeSeries(services, movements, from, to, me?.configuracao),
    [from, me?.configuracao, movements, services, to]
  );

  const officeRanking = useMemo(() => {
    const map = new Map();

    services.forEach((service) => {
      const id = service.oficina_id;
      const current = map.get(id) || {
        id,
        name: service.oficina?.nome || "Oficina sem nome",
        value: 0,
        count: 0,
      };
      current.value += safeNumber(service.valor);
      current.count += 1;
      map.set(id, current);
    });

    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [services]);

  const technicianRanking = useMemo(() => {
    const map = new Map();

    services.forEach((service) => {
      (service.servicos_tecnicos || []).forEach((link) => {
        if (technicianId && link.tecnico_id !== technicianId) return;
        const current = map.get(link.tecnico_id) || {
          id: link.tecnico_id,
          name: link.tecnico?.nome || "Técnico sem nome",
          value: 0,
          count: 0,
        };
        current.value += safeNumber(link.valor_repasse);
        current.count += 1;
        map.set(link.tecnico_id, current);
      });
    });

    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [services, technicianId]);

  const upcomingReceivables = useMemo(() => {
    return movements
      .filter(
        (movement) => isRevenue(movement) && !isPaid(movement.status) && movement.data_vencimento
      )
      .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)))
      .slice(0, 5);
  }, [movements]);

  const latestServices = services.slice(0, 8);
  const refreshing = loading || isPending;
  const greetingName = me?.usuario?.nome?.split(" ")?.[0] || "";

  if (loading && !me && rawServices.length === 0) return <SkeletonDashboard />;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {greetingName ? `Olá, ${greetingName}. ` : ""}Aqui está o pulso da operação.
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Visão geral
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(services, formatMoney)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-2 disabled:opacity-50"
            disabled={!services.length}
          >
            <Download className="size-4" strokeWidth={1.8} />
            Exportar CSV
          </button>

          <Link
            href="/panel/servicos?novo=1"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover active:scale-[0.98]"
          >
            <Plus className="size-4" strokeWidth={2} />
            Novo serviço
          </Link>
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <Filter className="size-4" strokeWidth={1.8} />
            </span>
            Filtros
          </div>

          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="sr-only">Período</span>
              <select
                value={preset}
                onChange={(event) => changePreset(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="today">Hoje</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
                <option value="previous_month">Mês anterior</option>
                <option value="year">Este ano</option>
                <option value="custom">Período personalizado</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Oficina</span>
              <select
                value={officeId}
                onChange={(event) => setOfficeId(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todas as oficinas</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="sr-only">Técnico</span>
              <select
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Todos os técnicos</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.nome}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => load({ force: true })}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-surface-2"
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                strokeWidth={1.8}
              />
              Atualizar
            </button>
          </div>
        </div>

        {preset === "custom" && (
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:max-w-xl">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <input
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
              <input
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </label>
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Faturamento"
          value={formatMoney(metrics.faturamento)}
          caption="Serviços no período"
          icon={TrendingUp}
        />
        <MetricCard
          label="Recebido"
          value={formatMoney(metrics.recebido)}
          caption="Receitas já liquidadas"
          icon={CheckCircle2}
          tone="success"
        />
        <MetricCard
          label="A receber"
          value={formatMoney(metrics.aReceber)}
          caption="Receitas ainda pendentes"
          icon={Clock3}
          tone="warning"
        />
        <MetricCard
          label="Resultado"
          value={formatMoney(metrics.resultado)}
          caption="Receitas menos despesas"
          icon={Gauge}
          tone={metrics.resultado >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-4 sm:p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                Faturamento por período
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Evolução dos serviços dentro dos filtros atuais.
              </p>
            </div>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
              {from} → {to}
            </span>
          </div>
          <div className="overflow-x-auto">
            <LineAreaChart data={timeSeries} compactMoney={compactMoney} />
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Recebimentos</h3>
              <p className="mt-1 text-xs text-muted-foreground">Liquidação das receitas do período</p>
            </div>
            <FinancialRing
              received={metrics.recebido}
              pending={metrics.aReceber}
              formatMoney={formatMoney}
            />
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-foreground">Indicadores operacionais</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Serviços", metrics.quantidadeServicos, ReceiptText],
                ["Ticket médio", formatMoney(metrics.ticketMedio), WalletCards],
                ["Oficinas", metrics.oficinasAtendidas, Building2],
                ["Técnicos ativos", metrics.tecnicosAtivos, Users],
              ].map(([label, value, Icon]) => (
                <div key={label} className="rounded-lg border border-border bg-background p-3">
                  <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
                  <p className="mt-3 text-lg font-semibold text-foreground">{value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-4 sm:p-5 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                Receita x despesa
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Visão econômica por competência.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground sm:flex">
              <CircleDollarSign className="size-4" strokeWidth={1.8} />
              {me?.configuracao?.moeda || "EUR"}
            </div>
          </div>
          <RevenueExpenseBars data={timeSeries} compactMoney={compactMoney} />
        </Card>

        <Card className="p-4 sm:p-5">
          <h3 className="text-base font-semibold text-foreground">Custos e repasses</h3>
          <p className="mt-1 text-sm text-muted-foreground">Leitura rápida do caixa de saída.</p>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-danger/10 text-danger">
                  <ArrowDownRight className="size-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Despesas</p>
                  <p className="text-sm font-semibold text-foreground">{formatMoney(metrics.despesas)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-success/10 text-success">
                  <ArrowUpRight className="size-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Repasses pagos</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(metrics.repassesPagos)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-warning/10 text-warning">
                  <Clock3 className="size-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Repasses pendentes</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(metrics.repassesPendentes)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Ranking de oficinas</h3>
              <p className="mt-1 text-sm text-muted-foreground">Por faturamento no período</p>
            </div>
            <Building2 className="size-5 text-muted-foreground" strokeWidth={1.8} />
          </div>
          <Ranking rows={officeRanking} formatMoney={formatMoney} type="money" />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Ranking de técnicos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Por repasse gerado no período</p>
            </div>
            <Wrench className="size-5 text-muted-foreground" strokeWidth={1.8} />
          </div>
          <Ranking rows={technicianRanking} formatMoney={formatMoney} type="money" />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:px-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">Últimos serviços</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tabela já respeita todos os filtros.</p>
            </div>
            <Link
              href="/servicos"
              className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>

          {latestServices.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-2 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Data</th>
                    <th className="px-5 py-3 font-medium">Oficina</th>
                    <th className="px-5 py-3 font-medium">Veículo</th>
                    <th className="px-5 py-3 font-medium">Técnico(s)</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {latestServices.map((service) => {
                    const vehicle = [service.veiculo?.marca, service.veiculo?.modelo]
                      .filter(Boolean)
                      .join(" ");
                    const techs = (service.servicos_tecnicos || [])
                      .map((link) => link.tecnico?.nome)
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <tr key={service.id} className="transition hover:bg-surface-2/60">
                        <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                          {new Intl.DateTimeFormat("pt-BR").format(
                            new Date(`${service.data_servico}T12:00:00`)
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-foreground">
                          {service.oficina?.nome || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-foreground">{vehicle || "—"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {service.veiculo?.placa || "Sem placa"}
                          </p>
                        </td>
                        <td className="max-w-60 truncate px-5 py-3.5 text-muted-foreground">
                          {techs || "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-foreground">
                          {formatMoney(service.valor)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyMini label="Nenhum serviço encontrado para os filtros atuais." />
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Próximos recebimentos</h3>
              <p className="mt-1 text-sm text-muted-foreground">Receitas pendentes com vencimento</p>
            </div>
            <Clock3 className="size-5 text-muted-foreground" strokeWidth={1.8} />
          </div>

          {upcomingReceivables.length ? (
            <div className="space-y-2">
              {upcomingReceivables.map((movement) => (
                <div
                  key={movement.id}
                  className="rounded-lg border border-border bg-background p-3 transition hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {movement.oficina?.nome || movement.descricao}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Vence em {movement.data_vencimento}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {formatMoney(movement.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyMini label="Nenhum recebimento pendente com vencimento neste período." />
          )}
        </Card>
      </div>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        Cache local de 30s + paginação em fila de até {MAX_ROWS.toLocaleString("pt-BR")} registros por
        conjunto. A resposta mais recente sempre vence, evitando dados antigos sobrescreverem filtros novos.
      </p>
    </div>
  );
}
