"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Filter,
  Layers3,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

import {
  Button,
  CurrencyInput,
  DateInput,
  Drawer,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Textarea,
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { localISO, todayISO } from "@/lib/dates";
import { downloadCsvReport, openPrintReport } from "@/lib/exportReports";
import { formatDateByConfig } from "@/lib/formatters";
import { toast } from "@/lib/toast";

const PAGE_SIZES = [12, 24, 48];
const FETCH_PAGE_SIZE = 1000;
const MAX_ROWS = 20000;

const COLOR_PRESETS = [
  "#16A269",
  "#2F80ED",
  "#7B61FF",
  "#D97706",
  "#DC4C4C",
  "#DB2777",
  "#0891B2",
  "#65A30D",
  "#F2C21B",
  "#78716C",
  "#0F766E",
  "#9333EA",
];

const MOVEMENT_SELECT = `
  id,
  conta_id,
  categoria_id,
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
  forma_pagamento,
  observacoes,
  created_by,
  updated_by,
  created_at,
  updated_at,
  categoria:categorias_financeiras(id,nome,tipo,grupo_dre,cor,ativo),
  oficina:oficinas(id,nome),
  tecnico:tecnicos(id,nome),
  servico:servicos(
    id,
    data_servico,
    valor,
    descricao,
    veiculo:veiculos(id,placa,marca,modelo)
  )
`;

function getPresetRange(preset, timezone) {
  const today = new Date(`${todayISO(timezone)}T12:00:00`);

  if (preset === "today") {
    const iso = localISO(today);
    return { from: iso, to: iso };
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
    to: localISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function sumBy(rows, selector) {
  return rows.reduce((total, row) => total + safeNumber(selector(row)), 0);
}

function isRevenue(row) {
  return String(row?.tipo || "").toLowerCase() === "receita";
}

function isExpense(row) {
  return String(row?.tipo || "").toLowerCase() === "despesa";
}

function isPaid(status) {
  return ["pago", "recebido", "paid"].includes(String(status || "").toLowerCase());
}

function isManual(row) {
  return String(row?.origem || "").toLowerCase() === "manual";
}

function safeHex(value, fallback = "#F2C21B") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function buildPagination(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("left-ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push("right-ellipsis");
  pages.push(totalPages);

  return pages;
}

function categoryMeta(movement) {
  if (movement?.categoria) {
    return {
      id: movement.categoria.id,
      name: movement.categoria.nome || "Sem categoria",
      color: safeHex(movement.categoria.cor, "#F2C21B"),
    };
  }

  if (movement?.origem === "servico") {
    return { id: null, name: "Serviços", color: "#16A269" };
  }

  if (movement?.origem === "repasse_tecnico") {
    return { id: null, name: "Repasse de técnicos", color: "#DC4C4C" };
  }

  return { id: null, name: "Sem categoria", color: "#78716C" };
}

function serviceLabel(movement) {
  const vehicle = movement?.servico?.veiculo;
  const vehicleName = [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ");
  const plate = vehicle?.placa;

  if (vehicleName && plate) return `${vehicleName} · ${plate}`;
  if (vehicleName) return vehicleName;
  if (plate) return plate;
  return null;
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
    // Cache opcional.
  }

  const response = await fetch("/api/me", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || "Não foi possível identificar o usuário.");
  }

  const data = await response.json();

  try {
    sessionStorage.setItem(
      "panel.me.v1",
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Cache opcional.
  }

  return data;
}

async function fetchPaged(queryFactory) {
  const rows = [];

  for (let start = 0; start < MAX_ROWS; start += FETCH_PAGE_SIZE) {
    const end = Math.min(start + FETCH_PAGE_SIZE - 1, MAX_ROWS - 1);
    const { data, error } = await queryFactory(start, end);

    if (error) throw error;
    rows.push(...(data || []));

    if (!data || data.length < FETCH_PAGE_SIZE) break;
  }

  return rows;
}

function MetricCard({ label, value, caption, icon: Icon, tone = "primary" }) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "danger"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-foreground";

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>

        <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
      </div>
    </section>
  );
}

function TypeBadge({ type }) {
  const revenue = type === "receita";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        revenue ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {revenue ? (
        <ArrowUpRight className="size-3.5" strokeWidth={2} />
      ) : (
        <ArrowDownRight className="size-3.5" strokeWidth={2} />
      )}
      {revenue ? "Receita" : "Despesa"}
    </span>
  );
}

function StatusBadge({ movement }) {
  const paid = isPaid(movement?.status);
  const revenue = isRevenue(movement);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        paid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
      }`}
    >
      <span className={`size-1.5 rounded-full ${paid ? "bg-success" : "bg-warning"}`} />
      {paid ? (revenue ? "Recebido" : "Pago") : "Pendente"}
    </span>
  );
}

function CategoryPill({ movement }) {
  const meta = categoryMeta(movement);

  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
      <span
        className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
        style={{ backgroundColor: meta.color }}
      />
      <span className="truncate">{meta.name}</span>
    </span>
  );
}

function CashPulse({ metrics, formatMoney }) {
  const max = Math.max(metrics.received, metrics.paid, 1);
  const receivedWidth = Math.max(4, (metrics.received / max) * 100);
  const paidWidth = Math.max(4, (metrics.paid / max) * 100);

  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <WalletCards className="size-4" strokeWidth={1.8} />
            </span>
            Pulso do caixa
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Entradas e saídas efetivamente liquidadas dentro dos lançamentos do período selecionado.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Entradas realizadas</p>
            <p className="mt-1 font-semibold text-success">{formatMoney(metrics.received)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${receivedWidth}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Saídas realizadas</p>
            <p className="mt-1 font-semibold text-danger">{formatMoney(metrics.paid)}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-danger"
                style={{ width: `${paidWidth}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Saldo realizado</p>
            <p
              className={`mt-1 font-semibold ${
                metrics.realizedBalance < 0 ? "text-danger" : "text-foreground"
              }`}
            >
              {formatMoney(metrics.realizedBalance)}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Pendente líquido: {formatMoney(metrics.pendingRevenue - metrics.pendingExpense)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
  );
}

function normalizeMovementForm(movement) {
  return {
    tipo: movement?.tipo || "receita",
    descricao: movement?.descricao || "",
    categoria_id: movement?.categoria_id || "",
    valor: movement?.valor ?? "",
    data_competencia: movement?.data_competencia || todayISO(),
    data_vencimento: movement?.data_vencimento || "",
    status: isPaid(movement?.status) ? "pago" : "pendente",
    data_pagamento: movement?.data_pagamento || "",
    forma_pagamento: movement?.forma_pagamento || "",
    oficina_id: movement?.oficina_id || "",
    tecnico_id: movement?.tecnico_id || "",
    observacoes: movement?.observacoes || "",
  };
}

function emptyMovementForm(type = "receita") {
  return {
    tipo: type,
    descricao: "",
    categoria_id: "",
    valor: "",
    data_competencia: todayISO(),
    data_vencimento: "",
    status: "pendente",
    data_pagamento: "",
    forma_pagamento: "",
    oficina_id: "",
    tecnico_id: "",
    observacoes: "",
  };
}

function emptyCategoryForm(type = "despesa") {
  return {
    nome: "",
    tipo: type,
    grupo_dre: "",
    cor: type === "receita" ? "#16A269" : "#DC4C4C",
    ativo: true,
  };
}

export default function FinanceiroPage() {
  const supabase = useMemo(() => createClient(), []);
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const meRef = useRef(null);
  const requestIdRef = useRef(0);

  const [me, setMe] = useState(null);
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [offices, setOffices] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("cashflow");
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryTypeFilter, setCategoryTypeFilter] = useState("all");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("active");

  const [movementOpen, setMovementOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [movementForm, setMovementForm] = useState(emptyMovementForm("receita"));
  const [movementErrors, setMovementErrors] = useState({});
  const [savingMovement, setSavingMovement] = useState(false);

  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementMovement, setSettlementMovement] = useState(null);
  const [settlementForm, setSettlementForm] = useState({
    data_pagamento: todayISO(),
    forma_pagamento: "",
    observacoes: "",
  });
  const [settling, setSettling] = useState(false);
  const [reopeningId, setReopeningId] = useState("");

  const [deleteMovementTarget, setDeleteMovementTarget] = useState(null);
  const [deletingMovement, setDeletingMovement] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm());
  const [categoryErrors, setCategoryErrors] = useState({});
  const [savingCategory, setSavingCategory] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const contaId = me?.usuario?.conta_id || "";
  const usuarioId = me?.usuario?.id || "";
  const currency = me?.configuracao?.moeda || "EUR";
  const locale = me?.configuracao?.locale || "it-IT";
  const timezone = me?.configuracao?.timezone || "Europe/Rome";

  const formatMoney = useCallback(
    (value) => {
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
    [currency, locale]
  );

  const formatDate = useCallback(
    (value) => {
      if (!value) return "Não informado";

      return formatDateByConfig(value, me?.configuracao) || String(value);
    },
    [me?.configuracao]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestIdRef.current;

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const meData = meRef.current || (await fetchMe());
        meRef.current = meData;

        const currentContaId = meData?.usuario?.conta_id;
        if (!currentContaId) throw new Error("Usuário sem conta vinculada.");

        const [movementRows, categoriesResult, officesResult, techniciansResult] =
          await Promise.all([
            fetchPaged((start, end) =>
              supabase
                .from("movimentacoes_financeiras")
                .select(MOVEMENT_SELECT)
                .eq("conta_id", currentContaId)
                .gte("data_competencia", from)
                .lte("data_competencia", to)
                .order("data_competencia", { ascending: false })
                .order("created_at", { ascending: false })
                .range(start, end)
            ),
            supabase
              .from("categorias_financeiras")
              .select(
                "id,conta_id,nome,tipo,grupo_dre,cor,ativo,created_by,updated_by,created_at,updated_at"
              )
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("tipo", { ascending: true })
              .order("nome", { ascending: true })
              .range(0, 4999),
            supabase
              .from("oficinas")
              .select("id,nome,ativo")
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("nome", { ascending: true })
              .range(0, 4999),
            supabase
              .from("tecnicos")
              .select("id,nome,ativo")
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("nome", { ascending: true })
              .range(0, 4999),
          ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (officesResult.error) throw officesResult.error;
        if (techniciansResult.error) throw techniciansResult.error;
        if (requestId !== requestIdRef.current) return;

        setMe(meData);
        setMovements(movementRows || []);
        setCategories(categoriesResult.data || []);
        setOffices(officesResult.data || []);
        setTechnicians(techniciansResult.data || []);
      } catch (loadError) {
        console.error("Financeiro load", loadError);
        if (requestId !== requestIdRef.current) return;

        const message =
          loadError?.message || "Não foi possível carregar os dados financeiros.";
        setError(message);
        toast.error("Não foi possível carregar", message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [from, supabase, to]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(frameId);
  }, [loadData]);

  function changePreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;

    const range = getPresetRange(nextPreset, timezone);
    setFrom(range.from);
    setTo(range.to);
  }

  const automaticCategoryIds = useMemo(() => {
    const serviceCategory =
      categories.find(
        (category) =>
          category.tipo === "receita" && normalizeText(category.nome) === "servicos"
      ) ||
      categories.find(
        (category) =>
          category.tipo === "receita" &&
          normalizeText(category.grupo_dre) === "receita operacional"
      );

    const transferCategory =
      categories.find(
        (category) =>
          category.tipo === "despesa" &&
          normalizeText(category.nome) === "repasse de tecnicos"
      ) ||
      categories.find(
        (category) =>
          category.tipo === "despesa" &&
          normalizeText(category.grupo_dre) === "custos diretos"
      );

    return {
      servico: serviceCategory?.id || "",
      repasse_tecnico: transferCategory?.id || "",
    };
  }, [categories]);

  const baseFilteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (statusFilter === "pending" && isPaid(movement.status)) return false;
      if (statusFilter === "paid" && !isPaid(movement.status)) return false;
      if (categoryFilter !== "all") {
        const fallbackCategoryId = movement.categoria_id
          ? ""
          : automaticCategoryIds[movement.origem] || "";

        if (movement.categoria_id !== categoryFilter && fallbackCategoryId !== categoryFilter) {
          return false;
        }
      }
      if (officeFilter !== "all" && movement.oficina_id !== officeFilter) return false;
      if (technicianFilter !== "all" && movement.tecnico_id !== technicianFilter) return false;
      return true;
    });
  }, [
    automaticCategoryIds,
    categoryFilter,
    movements,
    officeFilter,
    statusFilter,
    technicianFilter,
  ]);

  const metrics = useMemo(() => {
    const revenues = movements.filter(isRevenue);
    const expenses = movements.filter(isExpense);

    const received = sumBy(revenues.filter((movement) => isPaid(movement.status)), (row) => row.valor);
    const pendingRevenue = sumBy(
      revenues.filter((movement) => !isPaid(movement.status)),
      (row) => row.valor
    );
    const paid = sumBy(expenses.filter((movement) => isPaid(movement.status)), (row) => row.valor);
    const pendingExpense = sumBy(
      expenses.filter((movement) => !isPaid(movement.status)),
      (row) => row.valor
    );
    const totalRevenue = sumBy(revenues, (row) => row.valor);
    const totalExpense = sumBy(expenses, (row) => row.valor);

    return {
      received,
      pendingRevenue,
      paid,
      pendingExpense,
      totalRevenue,
      totalExpense,
      periodBalance: totalRevenue - totalExpense,
      realizedBalance: received - paid,
    };
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const term = normalizeText(search);

    return baseFilteredMovements
      .filter((movement) => {
        if (activeTab === "revenue" && !isRevenue(movement)) return false;
        if (activeTab === "expense" && !isExpense(movement)) return false;
        if (activeTab === "categories") return false;

        if (!term) return true;

        const meta = categoryMeta(movement);
        const vehicle = movement?.servico?.veiculo;
        const haystack = normalizeText(
          [
            movement.descricao,
            meta.name,
            movement.oficina?.nome,
            movement.tecnico?.nome,
            movement.forma_pagamento,
            movement.observacoes,
            vehicle?.placa,
            vehicle?.marca,
            vehicle?.modelo,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return haystack.includes(term);
      })
      .sort((a, b) => {
        const dateCompare = String(b.data_competencia || "").localeCompare(
          String(a.data_competencia || "")
        );
        if (dateCompare !== 0) return dateCompare;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
  }, [activeTab, baseFilteredMovements, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPage(1));
    return () => cancelAnimationFrame(frame);
  }, [activeTab, categoryFilter, officeFilter, pageSize, search, statusFilter, technicianFilter]);

  useEffect(() => {
    if (page <= totalPages) return undefined;
    const frame = requestAnimationFrame(() => setPage(totalPages));
    return () => cancelAnimationFrame(frame);
  }, [page, totalPages]);

  const pagedMovements = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMovements.slice(start, start + pageSize);
  }, [filteredMovements, page, pageSize]);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  );

  const categoryUsage = useMemo(() => {
    const map = new Map();
    movements.forEach((movement) => {
      const categoryId =
        movement.categoria_id || automaticCategoryIds[movement.origem] || "";
      if (!categoryId) return;
      map.set(categoryId, (map.get(categoryId) || 0) + 1);
    });
    return map;
  }, [automaticCategoryIds, movements]);

  const filteredCategories = useMemo(() => {
    const term = normalizeText(categorySearch);

    return categories.filter((category) => {
      if (categoryTypeFilter !== "all" && category.tipo !== categoryTypeFilter) return false;
      if (categoryStatusFilter === "active" && !category.ativo) return false;
      if (categoryStatusFilter === "inactive" && category.ativo) return false;

      if (!term) return true;
      return normalizeText([category.nome, category.grupo_dre].filter(Boolean).join(" ")).includes(term);
    });
  }, [categories, categorySearch, categoryStatusFilter, categoryTypeFilter]);

  const hasMovementFilters =
    search ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    officeFilter !== "all" ||
    technicianFilter !== "all";

  const hasCategoryFilters =
    categorySearch || categoryTypeFilter !== "all" || categoryStatusFilter !== "active";

  function resetMovementFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setOfficeFilter("all");
    setTechnicianFilter("all");
  }

  function resetCategoryFilters() {
    setCategorySearch("");
    setCategoryTypeFilter("all");
    setCategoryStatusFilter("active");
  }

  async function logAudit({ entity, action, recordId, description, before = null, after = null }) {
    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;

    if (!currentContaId) return;

    try {
      await supabase.from("auditoria").insert({
        conta_id: currentContaId,
        usuario_id: currentUsuarioId || null,
        entidade: entity,
        acao: action,
        registro_id: recordId || null,
        descricao: description,
        dados_anteriores: before,
        dados_novos: after,
      });
    } catch (auditError) {
      console.warn("Auditoria financeira não registrada", auditError);
    }
  }

  function openCreateMovement(type) {
    setEditingMovement(null);
    setMovementErrors({});
    setMovementForm({
      ...emptyMovementForm(type),
      data_competencia: todayISO(timezone),
    });
    setMovementOpen(true);
  }

  function openEditMovement(movement) {
    const normalized = normalizeMovementForm(movement);
    const fallbackCategoryId =
      !movement.categoria_id && movement.origem
        ? automaticCategoryIds[movement.origem] || ""
        : "";

    setEditingMovement(movement);
    setMovementErrors({});
    setMovementForm({
      ...normalized,
      categoria_id: normalized.categoria_id || fallbackCategoryId,
    });
    setMovementOpen(true);
  }

  const closeMovementForm = useCallback(() => {
    if (savingMovement) return;
    setMovementOpen(false);
    setEditingMovement(null);
    setMovementErrors({});
  }, [savingMovement]);

  function validateMovement() {
    const lockedAutomatic = editingMovement && !isManual(editingMovement);
    const nextErrors = {};

    if (!movementForm.categoria_id && !lockedAutomatic) {
      nextErrors.categoria_id = "Selecione uma categoria para o lançamento.";
    }

    if (!lockedAutomatic) {
      if (!cleanText(movementForm.descricao)) {
        nextErrors.descricao = "Informe uma descrição.";
      }

      if (safeNumber(movementForm.valor) <= 0) {
        nextErrors.valor = "Informe um valor maior que zero.";
      }

      if (!movementForm.data_competencia) {
        nextErrors.data_competencia = "Informe a data de competência.";
      }

      if (movementForm.status === "pago" && !movementForm.data_pagamento) {
        nextErrors.data_pagamento = "Informe a data do recebimento/pagamento.";
      }
    }

    setMovementErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveMovement(event) {
    event.preventDefault();
    if (!validateMovement()) return;

    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;

    if (!currentContaId) {
      toast.error("Conta não identificada", "Recarregue a página e tente novamente.");
      return;
    }

    const lockedAutomatic = editingMovement && !isManual(editingMovement);
    setSavingMovement(true);

    try {
      if (lockedAutomatic) {
        const payload = {
          categoria_id: movementForm.categoria_id || null,
          observacoes: cleanText(movementForm.observacoes),
          updated_by: currentUsuarioId || null,
          updated_at: new Date().toISOString(),
        };

        const before = { ...editingMovement };
        const { data, error: updateError } = await supabase
          .from("movimentacoes_financeiras")
          .update(payload)
          .eq("id", editingMovement.id)
          .eq("conta_id", currentContaId)
          .select(MOVEMENT_SELECT)
          .single();

        if (updateError) throw updateError;

        await logAudit({
          entity: "movimentacoes_financeiras",
          action: "categorizar",
          recordId: data.id,
          description: `Movimentação automática categorizada: ${data.descricao}.`,
          before,
          after: data,
        });

        toast.success("Movimentação atualizada", "Categoria e observações foram salvas.");
      } else {
        const paid = movementForm.status === "pago";
        const payload = {
          tipo: movementForm.tipo,
          origem: "manual",
          descricao: movementForm.descricao.trim(),
          categoria_id: movementForm.categoria_id || null,
          valor: safeNumber(movementForm.valor),
          status: paid ? "pago" : "pendente",
          data_competencia: movementForm.data_competencia,
          data_vencimento: movementForm.data_vencimento || null,
          data_pagamento: paid ? movementForm.data_pagamento || todayISO(timezone) : null,
          forma_pagamento: paid ? cleanText(movementForm.forma_pagamento) : null,
          oficina_id: movementForm.oficina_id || null,
          tecnico_id: movementForm.tecnico_id || null,
          observacoes: cleanText(movementForm.observacoes),
          updated_by: currentUsuarioId || null,
          updated_at: new Date().toISOString(),
        };

        if (editingMovement) {
          const before = { ...editingMovement };
          const { data, error: updateError } = await supabase
            .from("movimentacoes_financeiras")
            .update(payload)
            .eq("id", editingMovement.id)
            .eq("conta_id", currentContaId)
            .select(MOVEMENT_SELECT)
            .single();

          if (updateError) throw updateError;

          await logAudit({
            entity: "movimentacoes_financeiras",
            action: "atualizar",
            recordId: data.id,
            description: `${data.tipo === "receita" ? "Receita" : "Despesa"} ${data.descricao} atualizada.`,
            before,
            after: data,
          });

          toast.success("Lançamento atualizado", "As alterações foram salvas com sucesso.");
        } else {
          const { data, error: insertError } = await supabase
            .from("movimentacoes_financeiras")
            .insert({
              ...payload,
              conta_id: currentContaId,
              created_by: currentUsuarioId || null,
            })
            .select(MOVEMENT_SELECT)
            .single();

          if (insertError) throw insertError;

          await logAudit({
            entity: "movimentacoes_financeiras",
            action: "criar",
            recordId: data.id,
            description: `${data.tipo === "receita" ? "Receita" : "Despesa"} avulsa criada: ${data.descricao}.`,
            after: data,
          });

          toast.success(
            data.tipo === "receita" ? "Receita criada" : "Despesa criada",
            "O lançamento já está disponível no financeiro."
          );
        }
      }

      setMovementOpen(false);
      setEditingMovement(null);
      setMovementErrors({});
      await loadData({ silent: true });
    } catch (saveError) {
      console.error("Salvar movimentação", saveError);
      toast.error(
        "Não foi possível salvar",
        saveError?.message || "Verifique os dados e tente novamente."
      );
    } finally {
      setSavingMovement(false);
    }
  }

  function openSettlement(movement) {
    setSettlementMovement(movement);
    setSettlementForm({
      data_pagamento: movement.data_pagamento || todayISO(timezone),
      forma_pagamento: movement.forma_pagamento || "",
      observacoes: movement.observacoes || "",
    });
    setSettlementOpen(true);
  }

  async function handleSettlement(event) {
    event.preventDefault();
    if (!settlementMovement || !contaId) return;

    if (!settlementForm.data_pagamento) {
      toast.warning("Informe a data", "Selecione a data do recebimento ou pagamento.");
      return;
    }

    setSettling(true);

    try {
      const before = { ...settlementMovement };
      const payload = {
        status: "pago",
        data_pagamento: settlementForm.data_pagamento,
        forma_pagamento: cleanText(settlementForm.forma_pagamento),
        observacoes: cleanText(settlementForm.observacoes),
        updated_by: usuarioId || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("movimentacoes_financeiras")
        .update(payload)
        .eq("id", settlementMovement.id)
        .eq("conta_id", contaId)
        .select(MOVEMENT_SELECT)
        .single();

      if (updateError) throw updateError;

      await logAudit({
        entity: "movimentacoes_financeiras",
        action: isRevenue(data) ? "receber" : "pagar",
        recordId: data.id,
        description: `${isRevenue(data) ? "Receita recebida" : "Despesa paga"}: ${data.descricao}.`,
        before,
        after: data,
      });

      toast.success(
        isRevenue(data) ? "Receita recebida" : "Despesa paga",
        `${formatMoney(data.valor)} liquidado com sucesso.`
      );

      setSettlementOpen(false);
      setSettlementMovement(null);
      await loadData({ silent: true });
    } catch (settlementError) {
      console.error("Liquidar movimentação", settlementError);
      toast.error(
        "Não foi possível liquidar",
        settlementError?.message || "Tente novamente."
      );
    } finally {
      setSettling(false);
    }
  }

  async function reopenMovement(movement) {
    if (!movement?.id || !contaId || reopeningId) return;
    setReopeningId(movement.id);

    try {
      const before = { ...movement };
      const payload = {
        status: "pendente",
        data_pagamento: null,
        forma_pagamento: null,
        updated_by: usuarioId || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from("movimentacoes_financeiras")
        .update(payload)
        .eq("id", movement.id)
        .eq("conta_id", contaId)
        .select(MOVEMENT_SELECT)
        .single();

      if (updateError) throw updateError;

      await logAudit({
        entity: "movimentacoes_financeiras",
        action: "reabrir",
        recordId: data.id,
        description: `Movimentação voltou para pendente: ${data.descricao}.`,
        before,
        after: data,
      });

      toast.success("Movimentação reaberta", "O lançamento voltou para o status pendente.");
      await loadData({ silent: true });
    } catch (reopenError) {
      console.error("Reabrir movimentação", reopenError);
      toast.error(
        "Não foi possível reabrir",
        reopenError?.message || "Tente novamente."
      );
    } finally {
      setReopeningId("");
    }
  }

  async function confirmDeleteMovement() {
    if (!deleteMovementTarget || !contaId) return;

    if (!isManual(deleteMovementTarget)) {
      toast.warning(
        "Lançamento automático",
        "Movimentações geradas por serviço devem ser removidas ou corrigidas a partir do serviço de origem."
      );
      setDeleteMovementTarget(null);
      return;
    }

    setDeletingMovement(true);

    try {
      const before = { ...deleteMovementTarget };
      const { error: deleteError } = await supabase
        .from("movimentacoes_financeiras")
        .delete()
        .eq("id", deleteMovementTarget.id)
        .eq("conta_id", contaId)
        .eq("origem", "manual");

      if (deleteError) throw deleteError;

      await logAudit({
        entity: "movimentacoes_financeiras",
        action: "excluir",
        recordId: deleteMovementTarget.id,
        description: `Lançamento avulso excluído: ${deleteMovementTarget.descricao}.`,
        before,
      });

      toast.success("Lançamento excluído", "A movimentação foi removida do financeiro.");
      setDeleteMovementTarget(null);
      await loadData({ silent: true });
    } catch (deleteError) {
      console.error("Excluir movimentação", deleteError);
      toast.error(
        "Não foi possível excluir",
        deleteError?.message || "Tente novamente."
      );
    } finally {
      setDeletingMovement(false);
    }
  }

  function openCreateCategory(type = activeTab === "revenue" ? "receita" : "despesa") {
    setEditingCategory(null);
    setCategoryErrors({});
    setCategoryForm(emptyCategoryForm(type));
    setCategoryOpen(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);
    setCategoryErrors({});
    setCategoryForm({
      nome: category.nome || "",
      tipo: category.tipo || "despesa",
      grupo_dre: category.grupo_dre || "",
      cor: safeHex(category.cor),
      ativo: Boolean(category.ativo),
    });
    setCategoryOpen(true);
  }

  const closeCategoryForm = useCallback(() => {
    if (savingCategory) return;
    setCategoryOpen(false);
    setEditingCategory(null);
    setCategoryErrors({});
  }, [savingCategory]);

  function validateCategory() {
    const nextErrors = {};

    if (!cleanText(categoryForm.nome)) {
      nextErrors.nome = "Informe o nome da categoria.";
    }

    if (!/^#[0-9a-f]{6}$/i.test(String(categoryForm.cor || ""))) {
      nextErrors.cor = "Escolha uma cor válida.";
    }

    setCategoryErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveCategory(event) {
    event.preventDefault();
    if (!validateCategory() || !contaId) return;

    setSavingCategory(true);

    const payload = {
      nome: categoryForm.nome.trim(),
      tipo: categoryForm.tipo,
      grupo_dre: cleanText(categoryForm.grupo_dre),
      cor: safeHex(categoryForm.cor),
      ativo: Boolean(categoryForm.ativo),
      updated_by: usuarioId || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCategory) {
        if (editingCategory.tipo !== payload.tipo) {
          const { count, error: countError } = await supabase
            .from("movimentacoes_financeiras")
            .select("id", { count: "exact", head: true })
            .eq("conta_id", contaId)
            .eq("categoria_id", editingCategory.id);

          if (countError) throw countError;

          if ((count || 0) > 0) {
            toast.warning(
              "Tipo da categoria protegido",
              "Essa categoria já possui lançamentos. Para trocar de receita para despesa, crie uma nova categoria e preserve o histórico."
            );
            return;
          }
        }

        const before = { ...editingCategory };
        const { data, error: updateError } = await supabase
          .from("categorias_financeiras")
          .update(payload)
          .eq("id", editingCategory.id)
          .eq("conta_id", contaId)
          .select(
            "id,conta_id,nome,tipo,grupo_dre,cor,ativo,created_by,updated_by,created_at,updated_at"
          )
          .single();

        if (updateError) throw updateError;

        await logAudit({
          entity: "categorias_financeiras",
          action: "atualizar",
          recordId: data.id,
          description: `Categoria financeira ${data.nome} atualizada.`,
          before,
          after: data,
        });

        toast.success("Categoria atualizada", "Nome, grupo, cor e status foram salvos.");
      } else {
        const { data, error: insertError } = await supabase
          .from("categorias_financeiras")
          .insert({
            ...payload,
            conta_id: contaId,
            created_by: usuarioId || null,
          })
          .select(
            "id,conta_id,nome,tipo,grupo_dre,cor,ativo,created_by,updated_by,created_at,updated_at"
          )
          .single();

        if (insertError) throw insertError;

        await logAudit({
          entity: "categorias_financeiras",
          action: "criar",
          recordId: data.id,
          description: `Categoria financeira ${data.nome} criada.`,
          after: data,
        });

        toast.success("Categoria criada", "Ela já pode ser usada nos lançamentos.");
      }

      setCategoryOpen(false);
      setEditingCategory(null);
      setCategoryErrors({});
      await loadData({ silent: true });
    } catch (saveError) {
      console.error("Salvar categoria", saveError);
      const duplicate = String(saveError?.message || "").toLowerCase().includes("duplicate");
      toast.error(
        "Não foi possível salvar",
        duplicate
          ? "Já existe uma categoria com esse nome e tipo nesta conta."
          : saveError?.message || "Verifique os dados e tente novamente."
      );
    } finally {
      setSavingCategory(false);
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategoryTarget || !contaId) return;
    setDeletingCategory(true);

    try {
      const before = { ...deleteCategoryTarget };
      const { error: deleteError } = await supabase
        .from("categorias_financeiras")
        .delete()
        .eq("id", deleteCategoryTarget.id)
        .eq("conta_id", contaId);

      if (deleteError) throw deleteError;

      await logAudit({
        entity: "categorias_financeiras",
        action: "excluir",
        recordId: deleteCategoryTarget.id,
        description: `Categoria financeira ${deleteCategoryTarget.nome} excluída.`,
        before,
      });

      toast.success("Categoria excluída", "Lançamentos antigos vinculados ficam sem categoria.");
      setDeleteCategoryTarget(null);
      await loadData({ silent: true });
    } catch (deleteError) {
      console.error("Excluir categoria", deleteError);
      toast.error(
        "Não foi possível excluir",
        deleteError?.message || "Tente novamente."
      );
    } finally {
      setDeletingCategory(false);
    }
  }

  function movementExportRows(rows) {
    return rows.map((movement) => [
      formatDate(movement.data_competencia),
      movement.descricao || "",
      categoryMeta(movement).name,
      movement.oficina?.nome || "",
      movement.tecnico?.nome || "",
      movement.tipo === "receita" ? "Receita" : "Despesa",
      formatMoney(movement.valor),
      isPaid(movement.status) ? (isRevenue(movement) ? "Recebido" : "Pago") : "Pendente",
      movement.data_vencimento ? formatDate(movement.data_vencimento) : "",
      movement.data_pagamento ? formatDate(movement.data_pagamento) : "",
      movement.forma_pagamento || "",
    ]);
  }

  function exportCsv() {
    if (!filteredMovements.length) {
      toast.info("Nada para exportar", "Os filtros atuais não possuem movimentações.");
      return;
    }

    const header = [
      "Data",
      "Descrição",
      "Categoria",
      "Oficina",
      "Técnico",
      "Tipo",
      "Valor",
      "Status",
      "Vencimento",
      "Pagamento",
      "Forma de pagamento",
    ];

    downloadCsvReport({
      filename: `financeiro_${from}_${to}.csv`,
      title: "PDR Hub - Financeiro",
      metadata: [
        ["Periodo", `${formatDate(from)} ate ${formatDate(to)}`],
        ["Moeda", currency],
        ["Lancamentos", filteredMovements.length],
        ["Gerado em", todayISO()],
      ],
      sections: [
        {
          title: "Resumo financeiro",
          headers: ["Indicador", "Valor"],
          rows: [
            ["Receitas", formatMoney(metrics.totalRevenue)],
            ["Despesas", formatMoney(metrics.totalExpense)],
            ["Saldo do periodo", formatMoney(metrics.periodBalance)],
            ["Entradas realizadas", formatMoney(metrics.received)],
            ["Saidas realizadas", formatMoney(metrics.paid)],
            ["Saldo realizado", formatMoney(metrics.realizedBalance)],
          ],
        },
        {
          title: "Movimentacoes filtradas",
          headers: header,
          rows: movementExportRows(filteredMovements),
        },
      ],
    });

    toast.success("CSV gerado", "As movimentações filtradas foram exportadas.");
  }

  function printFinancialReport() {
    if (!filteredMovements.length) {
      toast.info("Nada para exportar", "Os filtros atuais nÃ£o possuem movimentaÃ§Ãµes.");
      return;
    }

    const opened = openPrintReport({
      title: "Relatorio financeiro",
      subtitle: me?.conta?.nome_fantasia || me?.conta?.nome || "PDR Hub",
      locale,
      metadata: [
        ["Periodo", `${formatDate(from)} ate ${formatDate(to)}`],
        ["Moeda", currency],
        ["Lancamentos", filteredMovements.length],
        ["Aba", activeTab === "revenue" ? "Receitas" : activeTab === "expense" ? "Despesas" : "Fluxo de caixa"],
      ],
      summaryCards: [
        { label: "Receitas", value: formatMoney(metrics.totalRevenue), tone: "success" },
        { label: "Despesas", value: formatMoney(metrics.totalExpense), tone: "danger" },
        {
          label: "Saldo periodo",
          value: formatMoney(metrics.periodBalance),
          tone: metrics.periodBalance >= 0 ? "success" : "danger",
        },
        {
          label: "Saldo realizado",
          value: formatMoney(metrics.realizedBalance),
          tone: metrics.realizedBalance >= 0 ? "success" : "danger",
        },
      ],
      sections: [
        {
          title: "Movimentacoes filtradas",
          description: "Exportacao com os mesmos filtros aplicados na tela.",
          headers: [
            "Data",
            "Descricao",
            "Categoria",
            "Oficina",
            "Tecnico",
            "Tipo",
            "Valor",
            "Status",
            "Vencimento",
            "Pagamento",
          ],
          rows: movementExportRows(filteredMovements).map((row) => row.slice(0, 10)),
          numericColumns: [6],
        },
      ],
    });

    if (!opened) {
      toast.warning("Pop-up bloqueado", "Permita pop-ups para imprimir ou salvar em PDF.");
    }
  }

  const movementColumns = [
      {
        key: "data_competencia",
        header: "Data",
        render: (value) => (
          <span className="whitespace-nowrap text-sm text-foreground">{formatDate(value)}</span>
        ),
      },
      {
        key: "descricao",
        header: "Descrição",
        render: (value, row) => {
          const secondary = serviceLabel(row);
          return (
            <div className="min-w-[210px]">
              <p className="font-medium text-foreground">{value}</p>
              {secondary ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{secondary}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "categoria",
        header: "Categoria",
        render: (_, row) => <CategoryPill movement={row} />,
      },
      {
        key: "vinculo",
        header: "Oficina / Técnico",
        render: (_, row) => (
          <div className="min-w-[160px] text-sm">
            <p className="text-foreground">{row.oficina?.nome || "Não informado"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{row.tecnico?.nome || "Não informado"}</p>
          </div>
        ),
      },
      {
        key: "tipo",
        header: "Tipo",
        render: (value) => <TypeBadge type={value} />,
      },
      {
        key: "valor",
        header: "Valor",
        align: "right",
        render: (value, row) => (
          <span
            className={`whitespace-nowrap font-semibold ${
              isRevenue(row) ? "text-success" : "text-foreground"
            }`}
          >
            {isExpense(row) ? "- " : "+ "}
            {formatMoney(value)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (_, row) => <StatusBadge movement={row} />,
      },
      {
        key: "data_vencimento",
        header: "Vencimento",
        render: (value) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(value)}
          </span>
        ),
      },
      {
        key: "data_pagamento",
        header: "Pagamento",
        render: (value) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(value)}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (_, row) => (
          <div className="flex min-w-[132px] items-center justify-end gap-1">
            {!isPaid(row.status) ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openSettlement(row)}
                aria-label={isRevenue(row) ? "Marcar como recebido" : "Marcar como pago"}
                title={isRevenue(row) ? "Marcar como recebido" : "Marcar como pago"}
              >
                <CheckCircle2 className="size-4" strokeWidth={1.8} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => reopenMovement(row)}
                disabled={reopeningId === row.id}
                aria-label="Voltar para pendente"
                title="Voltar para pendente"
              >
                <RotateCcw
                  className={`size-4 ${reopeningId === row.id ? "animate-spin" : ""}`}
                  strokeWidth={1.8}
                />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditMovement(row)}
              aria-label={isManual(row) ? "Editar lançamento" : "Categorizar lançamento"}
              title={isManual(row) ? "Editar lançamento" : "Categorizar lançamento"}
            >
              {isManual(row) ? (
                <Pencil className="size-4" strokeWidth={1.8} />
              ) : (
                <Tag className="size-4" strokeWidth={1.8} />
              )}
            </Button>

            {isManual(row) ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteMovementTarget(row)}
                aria-label="Excluir lançamento"
                title="Excluir lançamento"
              >
                <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
              </Button>
            ) : null}
          </div>
        ),
      },
    ];

  const categoryColumns = [
      {
        key: "nome",
        header: "Categoria",
        render: (value, row) => (
          <div className="flex min-w-[180px] items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: safeHex(row.cor) }}
            />
            <div>
              <p className="font-medium text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">
                {categoryUsage.get(row.id) || 0} lançamento(s) no período
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "tipo",
        header: "Tipo",
        render: (value) => <TypeBadge type={value} />,
      },
      {
        key: "grupo_dre",
        header: "Grupo DRE",
        render: (value) => (
          <span className="text-sm text-muted-foreground">{value || "Não definido"}</span>
        ),
      },
      {
        key: "ativo",
        header: "Status",
        render: (value) => (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              value ? "bg-success/10 text-success" : "bg-surface-2 text-muted-foreground"
            }`}
          >
            <span className={`size-1.5 rounded-full ${value ? "bg-success" : "bg-muted-foreground"}`} />
            {value ? "Ativa" : "Inativa"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (_, row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditCategory(row)}
              aria-label="Editar categoria"
              title="Editar categoria"
            >
              <Pencil className="size-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteCategoryTarget(row)}
              aria-label="Excluir categoria"
              title="Excluir categoria"
            >
              <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
            </Button>
          </div>
        ),
      },
    ];

  const lockedAutomaticMovement = editingMovement && !isManual(editingMovement);
  const movementCategoryOptions = categories.filter(
    (category) =>
      category.tipo === movementForm.tipo &&
      (category.ativo || category.id === movementForm.categoria_id)
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Acompanhe entradas, saídas, pendências e lançamentos avulsos em um só lugar.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Financeiro
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            leftIcon={RefreshCw}
            onClick={() => loadData({ silent: true })}
            disabled={refreshing}
          >
            {refreshing ? "Atualizando" : "Atualizar"}
          </Button>
          <Button
            variant="outline"
            leftIcon={Download}
            onClick={exportCsv}
            disabled={!filteredMovements.length || activeTab === "categories"}
          >
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            leftIcon={Printer}
            onClick={printFinancialReport}
            disabled={!filteredMovements.length || activeTab === "categories"}
          >
            Imprimir / PDF
          </Button>
          <Button
            variant="outline"
            leftIcon={ArrowDownRight}
            onClick={() => openCreateMovement("despesa")}
          >
            Nova despesa
          </Button>
          <Button leftIcon={ArrowUpRight} onClick={() => openCreateMovement("receita")}>
            Nova receita
          </Button>
        </div>
      </header>

      {loading ? (
        <LoadingCards />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="A receber"
            value={formatMoney(metrics.pendingRevenue)}
            caption="Receitas ainda pendentes"
            icon={CalendarDays}
            tone={metrics.pendingRevenue ? "warning" : "primary"}
          />
          <MetricCard
            label="Recebido"
            value={formatMoney(metrics.received)}
            caption="Entradas já liquidadas"
            icon={TrendingUp}
            tone="success"
          />
          <MetricCard
            label="A pagar"
            value={formatMoney(metrics.pendingExpense)}
            caption="Despesas ainda pendentes"
            icon={ReceiptText}
            tone={metrics.pendingExpense ? "warning" : "primary"}
          />
          <MetricCard
            label="Pago"
            value={formatMoney(metrics.paid)}
            caption="Saídas já liquidadas"
            icon={TrendingDown}
            tone="danger"
          />
          <MetricCard
            label="Saldo do período"
            value={formatMoney(metrics.periodBalance)}
            caption={`Caixa realizado: ${formatMoney(metrics.realizedBalance)}`}
            icon={CircleDollarSign}
            tone={metrics.periodBalance < 0 ? "danger" : "success"}
          />
        </section>
      )}

      {!loading && activeTab !== "categories" ? (
        <CashPulse metrics={metrics} formatMoney={formatMoney} />
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-2">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "cashflow", label: "Fluxo de caixa", icon: WalletCards },
            { id: "revenue", label: "Receitas", icon: ArrowUpRight },
            { id: "expense", label: "Despesas", icon: ArrowDownRight },
            { id: "categories", label: "Categorias", icon: Layers3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "primary" : "ghost"}
                size="sm"
                leftIcon={Icon}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
      </section>

      {activeTab === "categories" ? (
        <>
          <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                  <Filter className="size-4" strokeWidth={1.8} />
                </span>
                Categorias
              </div>

              <div className="grid flex-1 gap-2 md:grid-cols-3">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                  <Input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Buscar categoria ou grupo DRE..."
                    className="pl-9"
                  />
                </div>

                <Select
                  value={categoryTypeFilter}
                  onChange={(event) => setCategoryTypeFilter(event.target.value)}
                >
                  <option value="all">Receitas e despesas</option>
                  <option value="receita">Somente receitas</option>
                  <option value="despesa">Somente despesas</option>
                </Select>

                <Select
                  value={categoryStatusFilter}
                  onChange={(event) => setCategoryStatusFilter(event.target.value)}
                >
                  <option value="all">Ativas e inativas</option>
                  <option value="active">Somente ativas</option>
                  <option value="inactive">Somente inativas</option>
                </Select>
              </div>

              {hasCategoryFilters ? (
                <Button variant="ghost" leftIcon={X} onClick={resetCategoryFilters}>
                  Limpar
                </Button>
              ) : null}

              <Button leftIcon={Plus} onClick={() => openCreateCategory()}>
                Nova categoria
              </Button>
            </div>
          </section>

          <Table
            data={filteredCategories}
            columns={categoryColumns}
            loading={loading}
            emptyTitle="Nenhuma categoria encontrada"
            emptyDescription="Crie categorias para deixar receitas e despesas organizadas e fáceis de identificar."
          />
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                    <Filter className="size-4" strokeWidth={1.8} />
                  </span>
                  Filtros
                </div>

                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                  <Select value={preset} onChange={(event) => changePreset(event.target.value)}>
                    <option value="today">Hoje</option>
                    <option value="week">Esta semana</option>
                    <option value="month">Este mês</option>
                    <option value="previous_month">Mês anterior</option>
                    <option value="year">Este ano</option>
                    <option value="custom">Período personalizado</option>
                  </Select>

                  <div className="relative sm:col-span-2 lg:col-span-2 2xl:col-span-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      strokeWidth={1.8}
                    />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar descrição, placa, oficina..."
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Somente pendentes</option>
                    <option value="paid">Somente liquidados</option>
                  </Select>

                  <Select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">Todas as categorias</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nome}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={officeFilter}
                    onChange={(event) => setOfficeFilter(event.target.value)}
                  >
                    <option value="all">Todas as oficinas</option>
                    {offices.map((office) => (
                      <option key={office.id} value={office.id}>
                        {office.nome}
                      </option>
                    ))}
                  </Select>

                  <Select
                    value={technicianFilter}
                    onChange={(event) => setTechnicianFilter(event.target.value)}
                  >
                    <option value="all">Todos os técnicos</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.nome}
                      </option>
                    ))}
                  </Select>
                </div>

                {hasMovementFilters ? (
                  <Button variant="ghost" leftIcon={X} onClick={resetMovementFilters}>
                    Limpar
                  </Button>
                ) : null}
              </div>

              {preset === "custom" ? (
                <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:max-w-xl">
                  <FormField label="Data inicial">
                    <DateInput
                      value={from}
                      max={to}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </FormField>
                  <FormField label="Data final">
                    <DateInput
                      value={to}
                      min={from}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </FormField>
                </div>
              ) : null}
            </div>
          </section>

          {error ? (
            <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-sm font-medium text-danger">{error}</p>
            </section>
          ) : null}

          <Table
            data={pagedMovements}
            columns={movementColumns}
            loading={loading}
            emptyTitle="Nenhuma movimentação encontrada"
            emptyDescription={
              hasMovementFilters
                ? "Ajuste os filtros para visualizar outros lançamentos."
                : activeTab === "revenue"
                  ? "Crie uma receita avulsa ou aguarde os recebimentos gerados pelos serviços."
                  : activeTab === "expense"
                    ? "Crie uma despesa avulsa ou aguarde os repasses gerados pelos serviços."
                    : "Os lançamentos gerados pelos serviços e os lançamentos avulsos aparecerão aqui."
            }
          />

          {!loading && filteredMovements.length > 0 ? (
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Mostrando{" "}
                  <strong className="font-semibold text-foreground">
                    {(page - 1) * pageSize + 1}
                  </strong>{" "}
                  a{" "}
                  <strong className="font-semibold text-foreground">
                    {Math.min(page * pageSize, filteredMovements.length)}
                  </strong>{" "}
                  de{" "}
                  <strong className="font-semibold text-foreground">
                    {filteredMovements.length}
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  <span>Por página</span>
                  <Select
                    value={String(pageSize)}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="w-20"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.8} />
                </Button>

                {paginationItems.map((item) =>
                  typeof item === "number" ? (
                    <Button
                      key={item}
                      variant={item === page ? "primary" : "outline"}
                      size="icon"
                      onClick={() => setPage(item)}
                      aria-current={item === page ? "page" : undefined}
                    >
                      {item}
                    </Button>
                  ) : (
                    <span
                      key={item}
                      className="grid size-10 place-items-center text-sm text-muted-foreground"
                    >
                      ...
                    </span>
                  )
                )}

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  aria-label="Próxima página"
                >
                  <ChevronRight className="size-4" strokeWidth={1.8} />
                </Button>
              </div>
            </section>
          ) : null}
        </>
      )}

      <Drawer
        open={movementOpen}
        onClose={closeMovementForm}
        title={
          editingMovement
            ? lockedAutomaticMovement
              ? "Categorizar movimentação"
              : "Editar lançamento"
            : movementForm.tipo === "receita"
              ? "Nova receita"
              : "Nova despesa"
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={closeMovementForm} disabled={savingMovement}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="financial-movement-form"
              loading={savingMovement}
              leftIcon={editingMovement ? Pencil : Plus}
            >
              {editingMovement ? "Salvar alterações" : "Criar lançamento"}
            </Button>
          </div>
        }
      >
        <Form id="financial-movement-form" onSubmit={handleSaveMovement}>
          {lockedAutomaticMovement ? (
            <>
              <section className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                    <ReceiptText className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{editingMovement.descricao}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O valor, tipo e descrição deste lançamento vêm do serviço de origem e ficam
                      protegidos aqui para não quebrar a sincronização operacional.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        Valor:{" "}
                        <strong className="font-semibold text-foreground">
                          {formatMoney(editingMovement.valor)}
                        </strong>
                      </span>
                      <span className="text-muted-foreground">
                        Data:{" "}
                        <strong className="font-semibold text-foreground">
                          {formatDate(editingMovement.data_competencia)}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <FormSection
                title="Organização financeira"
                description="Você pode atribuir uma categoria e registrar observações internas."
              >
                <FormGrid>
                  <FormField label="Categoria">
                    <Select
                      value={movementForm.categoria_id}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          categoria_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Sem categoria</option>
                      {movementCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nome}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormGrid>

                <FormField label="Observações">
                  <Textarea
                    value={movementForm.observacoes}
                    onChange={(event) =>
                      setMovementForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Observações internas sobre este lançamento..."
                  />
                </FormField>
              </FormSection>
            </>
          ) : (
            <>
              <FormSection
                title="Lançamento"
                description="Dados principais da receita ou despesa avulsa."
              >
                <FormGrid>
                  <FormField label="Tipo" required>
                    <Select
                      value={movementForm.tipo}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          tipo: event.target.value,
                          categoria_id: "",
                        }))
                      }
                    >
                      <option value="receita">Receita</option>
                      <option value="despesa">Despesa</option>
                    </Select>
                  </FormField>

                  <FormField
                    label="Categoria"
                    required
                    error={movementErrors.categoria_id}
                  >
                    <Select
                      value={movementForm.categoria_id}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          categoria_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione a categoria</option>
                      {movementCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nome}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Descrição" required error={movementErrors.descricao}>
                    <Input
                      value={movementForm.descricao}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          descricao: event.target.value,
                        }))
                      }
                      placeholder={
                        movementForm.tipo === "receita"
                          ? "Ex.: Venda de ferramenta"
                          : "Ex.: Combustível da semana"
                      }
                    />
                  </FormField>

                  <FormField label="Valor" required error={movementErrors.valor}>
                    <CurrencyInput
                      value={movementForm.valor}
                      onValueChange={(value) =>
                        setMovementForm((current) => ({ ...current, valor: value }))
                      }
                      currency={currency}
                      locale={locale}
                    />
                  </FormField>

                  <FormField
                    label="Data de competência"
                    required
                    error={movementErrors.data_competencia}
                  >
                    <DateInput
                      value={movementForm.data_competencia}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          data_competencia: event.target.value,
                        }))
                      }
                    />
                  </FormField>

                  <FormField label="Vencimento">
                    <DateInput
                      value={movementForm.data_vencimento}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          data_vencimento: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                </FormGrid>
              </FormSection>

              <FormSection
                title="Situação"
                description="O lançamento pode nascer pendente ou já liquidado."
              >
                <FormGrid>
                  <FormField label="Status">
                    <Select
                      value={movementForm.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value;
                        setMovementForm((current) => ({
                          ...current,
                          status: nextStatus,
                          data_pagamento:
                            nextStatus === "pago"
                              ? current.data_pagamento || todayISO(timezone)
                              : "",
                          forma_pagamento:
                            nextStatus === "pago" ? current.forma_pagamento : "",
                        }));
                      }}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">
                        {movementForm.tipo === "receita" ? "Recebido" : "Pago"}
                      </option>
                    </Select>
                  </FormField>

                  {movementForm.status === "pago" ? (
                    <>
                      <FormField
                        label={
                          movementForm.tipo === "receita"
                            ? "Data do recebimento"
                            : "Data do pagamento"
                        }
                        required
                        error={movementErrors.data_pagamento}
                      >
                        <DateInput
                          value={movementForm.data_pagamento}
                          onChange={(event) =>
                            setMovementForm((current) => ({
                              ...current,
                              data_pagamento: event.target.value,
                            }))
                          }
                        />
                      </FormField>

                      <FormField label="Forma de pagamento">
                        <Input
                          value={movementForm.forma_pagamento}
                          onChange={(event) =>
                            setMovementForm((current) => ({
                              ...current,
                              forma_pagamento: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Transferência, dinheiro, cartão..."
                        />
                      </FormField>
                    </>
                  ) : null}
                </FormGrid>
              </FormSection>

              <FormSection
                title="Vínculos opcionais"
                description="Use apenas quando o lançamento fizer sentido para uma oficina ou técnico específico."
              >
                <FormGrid>
                  <FormField label="Oficina">
                    <Select
                      value={movementForm.oficina_id}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          oficina_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Sem oficina vinculada</option>
                      {offices.map((office) => (
                        <option key={office.id} value={office.id}>
                          {office.nome}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Técnico">
                    <Select
                      value={movementForm.tecnico_id}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          tecnico_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Sem técnico vinculado</option>
                      {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id}>
                          {technician.nome}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormGrid>

                <FormField label="Observações">
                  <Textarea
                    value={movementForm.observacoes}
                    onChange={(event) =>
                      setMovementForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Detalhes internos, referência, comprovante, contexto..."
                  />
                </FormField>
              </FormSection>
            </>
          )}
        </Form>
      </Drawer>

      <Modal
        open={settlementOpen}
        onClose={() => {
          if (settling) return;
          setSettlementOpen(false);
          setSettlementMovement(null);
        }}
        title={
          settlementMovement
            ? isRevenue(settlementMovement)
              ? "Marcar como recebido"
              : "Marcar como pago"
            : "Liquidar movimentação"
        }
        description={
          settlementMovement
            ? `${settlementMovement.descricao} · ${formatMoney(settlementMovement.valor)}`
            : undefined
        }
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (settling) return;
                setSettlementOpen(false);
                setSettlementMovement(null);
              }}
              disabled={settling}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="settlement-form"
              loading={settling}
              leftIcon={CheckCircle2}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <Form id="settlement-form" onSubmit={handleSettlement}>
          <FormSection>
            <FormGrid>
              <FormField label="Data" required>
                <DateInput
                  value={settlementForm.data_pagamento}
                  onChange={(event) =>
                    setSettlementForm((current) => ({
                      ...current,
                      data_pagamento: event.target.value,
                    }))
                  }
                />
              </FormField>

              <FormField label="Forma de pagamento">
                <Input
                  value={settlementForm.forma_pagamento}
                  onChange={(event) =>
                    setSettlementForm((current) => ({
                      ...current,
                      forma_pagamento: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Transferência, dinheiro, cartão..."
                />
              </FormField>
            </FormGrid>

            <FormField label="Observações">
              <Textarea
                value={settlementForm.observacoes}
                onChange={(event) =>
                  setSettlementForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Observação opcional sobre a liquidação..."
              />
            </FormField>
          </FormSection>
        </Form>
      </Modal>

      <Modal
        open={Boolean(deleteMovementTarget)}
        onClose={() => {
          if (!deletingMovement) setDeleteMovementTarget(null);
        }}
        title="Excluir lançamento"
        description="Esta ação não poderá ser desfeita."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteMovementTarget(null)}
              disabled={deletingMovement}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteMovement}
              loading={deletingMovement}
              leftIcon={Trash2}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deseja excluir o lançamento{" "}
          <strong className="font-semibold text-foreground">
            {deleteMovementTarget?.descricao}
          </strong>
          ? Somente lançamentos avulsos podem ser excluídos pelo Financeiro.
        </p>
      </Modal>

      <Drawer
        open={categoryOpen}
        onClose={closeCategoryForm}
        title={editingCategory ? "Editar categoria" : "Nova categoria"}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={closeCategoryForm} disabled={savingCategory}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="financial-category-form"
              loading={savingCategory}
              leftIcon={editingCategory ? Pencil : Plus}
            >
              {editingCategory ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </div>
        }
      >
        <Form id="financial-category-form" onSubmit={handleSaveCategory}>
          <FormSection
            title="Identificação"
            description="A cor aparece como um marcador visual em todo o financeiro."
          >
            <FormGrid>
              <FormField label="Nome" required error={categoryErrors.nome}>
                <Input
                  value={categoryForm.nome}
                  onChange={(event) =>
                    setCategoryForm((current) => ({ ...current, nome: event.target.value }))
                  }
                  placeholder="Ex.: Combustível"
                />
              </FormField>

              <FormField label="Tipo" required>
                <Select
                  value={categoryForm.tipo}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setCategoryForm((current) => ({
                      ...current,
                      tipo: nextType,
                      cor:
                        editingCategory || current.cor !== "#16A269" && current.cor !== "#DC4C4C"
                          ? current.cor
                          : nextType === "receita"
                            ? "#16A269"
                            : "#DC4C4C",
                    }));
                  }}
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </Select>
              </FormField>

              <FormField label="Grupo DRE">
                <Input
                  list="financial-dre-groups"
                  value={categoryForm.grupo_dre}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      grupo_dre: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Despesas operacionais"
                />
                <datalist id="financial-dre-groups">
                  <option value="Receita operacional" />
                  <option value="Outras receitas" />
                  <option value="Custos diretos" />
                  <option value="Despesas operacionais" />
                  <option value="Outras despesas" />
                </datalist>
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Cor"
            description="Escolha um marcador que ajude a bater o olho e entender o lançamento."
          >
            <FormField error={categoryErrors.cor}>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((color) => (
                  <label
                    key={color}
                    className={`grid size-9 cursor-pointer place-items-center rounded-full border transition ${
                      safeHex(categoryForm.cor) === color
                        ? "border-foreground bg-surface-2"
                        : "border-transparent hover:border-border-strong"
                    }`}
                    title={color}
                  >
                    <input
                      type="radio"
                      name="category-color"
                      value={color}
                      checked={safeHex(categoryForm.cor) === color}
                      onChange={() =>
                        setCategoryForm((current) => ({ ...current, cor: color }))
                      }
                      className="sr-only"
                    />
                    <span
                      className="size-5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </label>
                ))}

                <div className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 pr-3">
                  <input
                    type="color"
                    value={safeHex(categoryForm.cor)}
                    onChange={(event) =>
                      setCategoryForm((current) => ({
                        ...current,
                        cor: event.target.value.toUpperCase(),
                      }))
                    }
                    className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label="Escolher cor personalizada"
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {safeHex(categoryForm.cor)}
                  </span>
                </div>
              </div>
            </FormField>
          </FormSection>

          <FormSection title="Disponibilidade" description="Categorias inativas ficam no histórico, mas saem dos novos lançamentos.">
            <FormField label="Categoria ativa">
              <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
                <Switch
                  id="financial-category-active"
                  checked={categoryForm.ativo}
                  onCheckedChange={(checked) =>
                    setCategoryForm((current) => ({ ...current, ativo: checked }))
                  }
                />
                <label
                  htmlFor="financial-category-active"
                  className="cursor-pointer text-sm text-muted-foreground"
                >
                  {categoryForm.ativo
                    ? "Disponível para novos lançamentos"
                    : "Mantida apenas no histórico"}
                </label>
              </div>
            </FormField>
          </FormSection>
        </Form>
      </Drawer>

      <Modal
        open={Boolean(deleteCategoryTarget)}
        onClose={() => {
          if (!deletingCategory) setDeleteCategoryTarget(null);
        }}
        title="Excluir categoria"
        description="A categoria será removida, mas os lançamentos financeiros serão preservados."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteCategoryTarget(null)}
              disabled={deletingCategory}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteCategory}
              loading={deletingCategory}
              leftIcon={Trash2}
            >
              Excluir categoria
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Deseja excluir{" "}
            <strong className="font-semibold text-foreground">
              {deleteCategoryTarget?.nome}
            </strong>
            ?
          </p>
          {(categoryUsage.get(deleteCategoryTarget?.id) || 0) > 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning">
              Ela aparece em {categoryUsage.get(deleteCategoryTarget?.id)} lançamento(s) do período
              atual. Esses lançamentos continuarão existindo, mas ficarão sem categoria.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
