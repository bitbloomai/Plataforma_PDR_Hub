"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Layers3,
  Pencil,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sigma,
  Tags,
  Trash2,
  TriangleAlert,
  TrendingUp,
  X,
} from "lucide-react";

import {
  Button,
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
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
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

const DRE_GROUPS = [
  {
    id: "receita_operacional",
    label: "Receita operacional",
    type: "receita",
    description: "Receitas geradas pela atividade principal da operação.",
  },
  {
    id: "outras_receitas",
    label: "Outras receitas",
    type: "receita",
    description: "Receitas eventuais ou que não pertencem à atividade principal.",
  },
  {
    id: "custos_diretos",
    label: "Custos diretos",
    type: "despesa",
    description: "Custos diretamente ligados à execução dos serviços.",
  },
  {
    id: "despesas_operacionais",
    label: "Despesas operacionais",
    type: "despesa",
    description: "Despesas necessárias para manter a operação funcionando.",
  },
  {
    id: "outras_despesas",
    label: "Outras despesas",
    type: "despesa",
    description: "Despesas eventuais ou fora da rotina operacional principal.",
  },
];

const MOVEMENT_SELECT = `
  id,
  conta_id,
  categoria_id,
  tipo,
  origem,
  descricao,
  valor,
  status,
  data_competencia,
  created_at,
  categoria:categorias_financeiras(id,nome,tipo,grupo_dre,cor,ativo)
`;

function localISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalISO(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function inclusiveDays(from, to) {
  const start = parseLocalISO(from);
  const end = parseLocalISO(to);
  if (!start || !end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function getPreviousRange(from, to) {
  const start = parseLocalISO(from);
  if (!start) return { from, to };

  const length = Math.max(1, inclusiveDays(from, to));
  const previousTo = addDays(start, -1);
  const previousFrom = addDays(previousTo, -(length - 1));

  return {
    from: localISO(previousFrom),
    to: localISO(previousTo),
  };
}

function getPresetRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  if (preset === "previous_month") {
    return {
      from: localISO(new Date(today.getFullYear(), today.getMonth() - 1, 1, 12)),
      to: localISO(new Date(today.getFullYear(), today.getMonth(), 0, 12)),
    };
  }

  if (preset === "quarter") {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    return {
      from: localISO(new Date(today.getFullYear(), quarterStartMonth, 1, 12)),
      to: localISO(today),
    };
  }

  if (preset === "year") {
    return {
      from: `${today.getFullYear()}-01-01`,
      to: localISO(today),
    };
  }

  return {
    from: localISO(new Date(today.getFullYear(), today.getMonth(), 1, 12)),
    to: localISO(today),
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

function safeHex(value, fallback = "#F2C21B") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function isRevenue(row) {
  return String(row?.tipo || "").toLowerCase() === "receita";
}

function getGroupById(id) {
  return DRE_GROUPS.find((group) => group.id === id) || null;
}

function normalizeGroupId(value) {
  const normalized = normalizeText(value);

  if (["receita operacional", "receitas operacionais"].includes(normalized)) {
    return "receita_operacional";
  }

  if (["outras receitas", "outra receita"].includes(normalized)) {
    return "outras_receitas";
  }

  if (["custos diretos", "custo direto", "custos", "custo"].includes(normalized)) {
    return "custos_diretos";
  }

  if (["despesas operacionais", "despesa operacional"].includes(normalized)) {
    return "despesas_operacionais";
  }

  if (["outras despesas", "outra despesa"].includes(normalized)) {
    return "outras_despesas";
  }

  return null;
}

function resolveMovementGroup(movement) {
  const categoryGroupId = normalizeGroupId(movement?.categoria?.grupo_dre);
  const categoryGroup = getGroupById(categoryGroupId);

  if (categoryGroup && categoryGroup.type === movement?.tipo) {
    return categoryGroup.id;
  }

  if (movement?.origem === "servico" && isRevenue(movement)) {
    return "receita_operacional";
  }

  if (movement?.origem === "repasse_tecnico" && !isRevenue(movement)) {
    return "custos_diretos";
  }

  return null;
}

function movementCategoryMeta(movement) {
  if (movement?.categoria) {
    return {
      key: movement.categoria.id,
      id: movement.categoria.id,
      name: movement.categoria.nome || "Sem categoria",
      color: safeHex(movement.categoria.cor, "#78716C"),
      implicit: false,
    };
  }

  if (movement?.origem === "servico") {
    return {
      key: "implicit-servicos",
      id: null,
      name: "Serviços",
      color: "#16A269",
      implicit: true,
    };
  }

  if (movement?.origem === "repasse_tecnico") {
    return {
      key: "implicit-repasses",
      id: null,
      name: "Repasse de técnicos",
      color: "#DC4C4C",
      implicit: true,
    };
  }

  return {
    key: isRevenue(movement) ? "uncategorized-revenue" : "uncategorized-expense",
    id: null,
    name: "Sem categoria",
    color: "#78716C",
    implicit: true,
  };
}

function buildDreSnapshot(movements = []) {
  const groupTotals = Object.fromEntries(DRE_GROUPS.map((group) => [group.id, 0]));
  const categoryMap = new Map();
  let unclassifiedRevenue = 0;
  let unclassifiedExpense = 0;
  let unclassifiedCount = 0;
  let classifiedCount = 0;

  movements.forEach((movement) => {
    const amount = Math.abs(safeNumber(movement.valor));
    const groupId = resolveMovementGroup(movement);
    const meta = movementCategoryMeta(movement);
    const revenue = isRevenue(movement);

    if (groupId) {
      groupTotals[groupId] += amount;
      classifiedCount += 1;
    } else {
      unclassifiedCount += 1;
      if (revenue) unclassifiedRevenue += amount;
      else unclassifiedExpense += amount;
    }

    const rowGroupId = groupId || (revenue ? "sem_classificacao_receita" : "sem_classificacao_despesa");
    const rowKey = `${rowGroupId}:${meta.key}`;
    const existing = categoryMap.get(rowKey) || {
      key: rowKey,
      categoryId: meta.id,
      categoryName: meta.name,
      color: meta.color,
      type: revenue ? "receita" : "despesa",
      groupId: rowGroupId,
      groupLabel: groupId
        ? getGroupById(groupId)?.label || "Sem classificação"
        : "Sem classificação DRE",
      implicit: meta.implicit,
      amount: 0,
      count: 0,
    };

    existing.amount += amount;
    existing.count += 1;
    categoryMap.set(rowKey, existing);
  });

  const operatingRevenue = groupTotals.receita_operacional;
  const otherRevenue = groupTotals.outras_receitas;
  const directCosts = groupTotals.custos_diretos;
  const operatingExpenses = groupTotals.despesas_operacionais;
  const otherExpenses = groupTotals.outras_despesas;

  const totalRevenue = operatingRevenue + otherRevenue + unclassifiedRevenue;
  const totalExpenses = directCosts + operatingExpenses + otherExpenses + unclassifiedExpense;
  const grossResult = operatingRevenue - directCosts;
  const operatingResult = grossResult - operatingExpenses;
  const netResult =
    operatingResult +
    otherRevenue -
    otherExpenses +
    unclassifiedRevenue -
    unclassifiedExpense;
  const margin = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;
  const totalMovements = movements.length;
  const classificationCoverage = totalMovements > 0 ? (classifiedCount / totalMovements) * 100 : 100;

  return {
    groupTotals,
    categoryRows: Array.from(categoryMap.values()),
    operatingRevenue,
    otherRevenue,
    directCosts,
    operatingExpenses,
    otherExpenses,
    unclassifiedRevenue,
    unclassifiedExpense,
    unclassifiedCount,
    classifiedCount,
    totalRevenue,
    totalExpenses,
    grossResult,
    operatingResult,
    netResult,
    margin,
    totalMovements,
    classificationCoverage,
  };
}

function mergeCategoryRows(currentRows, previousRows, totalRevenue, totalExpenses) {
  const map = new Map();

  currentRows.forEach((row) => {
    map.set(row.key, {
      ...row,
      currentAmount: row.amount,
      previousAmount: 0,
    });
  });

  previousRows.forEach((row) => {
    const existing = map.get(row.key);
    if (existing) {
      existing.previousAmount = row.amount;
    } else {
      map.set(row.key, {
        ...row,
        amount: 0,
        currentAmount: 0,
        previousAmount: row.amount,
        count: 0,
      });
    }
  });

  return Array.from(map.values()).map((row) => {
    const base = row.type === "receita" ? totalRevenue : totalExpenses;
    return {
      ...row,
      participation: base > 0 ? (row.currentAmount / base) * 100 : 0,
    };
  });
}

function percentChange(current, previous) {
  const currentValue = safeNumber(current);
  const previousValue = safeNumber(previous);

  if (previousValue === 0) {
    if (currentValue === 0) return 0;
    return null;
  }

  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
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

function emptyCategoryForm(type = "despesa") {
  return {
    nome: "",
    tipo: type,
    grupo_dre: type === "receita" ? "Receita operacional" : "Despesas operacionais",
    cor: type === "receita" ? "#16A269" : "#DC4C4C",
    ativo: true,
  };
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

function DeltaBadge({ current, previous, suffix = "%", invert = false }) {
  const change = percentChange(current, previous);

  if (change === null) {
    return (
      <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-foreground">
        novo período
      </span>
    );
  }

  const improved = invert ? change <= 0 : change >= 0;
  const tone =
    Math.abs(change) < 0.005
      ? "bg-surface-2 text-muted-foreground"
      : improved
        ? "bg-success/10 text-success"
        : "bg-danger/10 text-danger";

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}>
      {change > 0 ? "+" : ""}
      {change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {suffix}
    </span>
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

function GroupBadge({ groupId }) {
  const group = getGroupById(groupId);

  if (!group) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
        <TriangleAlert className="size-3.5" strokeWidth={1.9} />
        Sem classificação
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground">
      {group.label}
    </span>
  );
}

function StatementRow({
  label,
  value,
  previousValue,
  compare,
  formatMoney,
  kind = "normal",
  sign = "",
  invertDelta = false,
}) {
  const strong = kind === "total" || kind === "result" || kind === "subtotal";
  const resultTone =
    kind === "result"
      ? value < 0
        ? "text-danger"
        : "text-success"
      : "text-foreground";

  return (
    <div
      className={`grid min-w-[650px] grid-cols-[minmax(260px,1fr)_160px_160px_100px] items-center gap-3 px-4 py-3 sm:px-5 ${
        kind === "result"
          ? "bg-primary/10"
          : kind === "subtotal"
            ? "bg-surface-2/70"
            : ""
      }`}
    >
      <div className={`flex items-center gap-2 ${strong ? "font-semibold" : "font-medium"}`}>
        {sign ? (
          <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
            {sign}
          </span>
        ) : null}
        <span className={resultTone}>{label}</span>
      </div>

      <div className={`text-right ${strong ? "font-semibold" : "font-medium"} ${resultTone}`}>
        {formatMoney(value)}
      </div>

      <div className="text-right text-sm text-muted-foreground">
        {compare ? formatMoney(previousValue) : "—"}
      </div>

      <div className="flex justify-end">
        {compare ? (
          <DeltaBadge
            current={value}
            previous={previousValue}
            invert={invertDelta}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  pageSize,
  totalItems,
  totalPages,
  paginationItems,
  onPageChange,
  onPageSizeChange,
}) {
  if (!totalItems) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          Mostrando{" "}
          <strong className="font-semibold text-foreground">
            {(page - 1) * pageSize + 1}
          </strong>{" "}
          a{" "}
          <strong className="font-semibold text-foreground">
            {Math.min(page * pageSize, totalItems)}
          </strong>{" "}
          de <strong className="font-semibold text-foreground">{totalItems}</strong>
        </span>

        <div className="flex items-center gap-2">
          <span>Por página</span>
          <Select
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
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
          onClick={() => onPageChange(Math.max(1, page - 1))}
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
              onClick={() => onPageChange(item)}
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
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Próxima página"
        >
          <ChevronRight className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
    </section>
  );
}

export default function DrePage() {
  const supabase = useMemo(() => createClient(), []);
  const initialRange = useMemo(() => getPresetRange("month"), []);
  const meRef = useRef(null);
  const requestIdRef = useRef(0);

  const [me, setMe] = useState(null);
  const [movements, setMovements] = useState([]);
  const [previousMovements, setPreviousMovements] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("statement");
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [comparePrevious, setComparePrevious] = useState(true);

  const [detailSearch, setDetailSearch] = useState("");
  const [detailGroupFilter, setDetailGroupFilter] = useState("all");
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(PAGE_SIZES[0]);

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryTypeFilter, setCategoryTypeFilter] = useState("all");
  const [categoryGroupFilter, setCategoryGroupFilter] = useState("all");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("active");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(PAGE_SIZES[0]);

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

  const previousRange = useMemo(() => getPreviousRange(from, to), [from, to]);

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

  const formatPercent = useCallback(
    (value) => {
      try {
        return new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(safeNumber(value) / 100);
      } catch {
        return `${safeNumber(value).toFixed(1)}%`;
      }
    },
    [locale]
  );

  const formatDate = useCallback(
    (value) => {
      if (!value) return "Não informado";

      return formatDateByConfig(value, me?.configuracao) || String(value);
    },
    [me?.configuracao]
  );

  const periodLabel = useMemo(
    () => `${formatDate(from)} a ${formatDate(to)}`,
    [formatDate, from, to]
  );

  const previousPeriodLabel = useMemo(
    () => `${formatDate(previousRange.from)} a ${formatDate(previousRange.to)}`,
    [formatDate, previousRange]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestIdRef.current;

      if (!from || !to || from > to) {
        setError("O período informado é inválido.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const meData = meRef.current || (await fetchMe());
        meRef.current = meData;

        const currentContaId = meData?.usuario?.conta_id;
        if (!currentContaId) throw new Error("Usuário sem conta vinculada.");

        const [movementRows, previousRows, categoriesResult] = await Promise.all([
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
          comparePrevious
            ? fetchPaged((start, end) =>
                supabase
                  .from("movimentacoes_financeiras")
                  .select(MOVEMENT_SELECT)
                  .eq("conta_id", currentContaId)
                  .gte("data_competencia", previousRange.from)
                  .lte("data_competencia", previousRange.to)
                  .order("data_competencia", { ascending: false })
                  .order("created_at", { ascending: false })
                  .range(start, end)
              )
            : Promise.resolve([]),
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
        ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (requestId !== requestIdRef.current) return;

        setMe(meData);
        setMovements(movementRows || []);
        setPreviousMovements(previousRows || []);
        setCategories(categoriesResult.data || []);
      } catch (loadError) {
        console.error("DRE load", loadError);
        if (requestId !== requestIdRef.current) return;

        const message = loadError?.message || "Não foi possível carregar os dados do DRE.";
        setError(message);
        toast.error("Não foi possível carregar", message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [comparePrevious, from, previousRange.from, previousRange.to, supabase, to]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(frameId);
  }, [loadData]);

  function changePreset(nextPreset) {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;

    const range = getPresetRange(nextPreset);
    setFrom(range.from);
    setTo(range.to);
  }

  const snapshot = useMemo(() => buildDreSnapshot(movements), [movements]);
  const previousSnapshot = useMemo(
    () => buildDreSnapshot(previousMovements),
    [previousMovements]
  );

  const categoryComparisonRows = useMemo(
    () =>
      mergeCategoryRows(
        snapshot.categoryRows,
        previousSnapshot.categoryRows,
        snapshot.totalRevenue,
        snapshot.totalExpenses
      ),
    [previousSnapshot.categoryRows, snapshot.categoryRows, snapshot.totalExpenses, snapshot.totalRevenue]
  );

  const filteredDetailRows = useMemo(() => {
    const term = normalizeText(detailSearch);

    return categoryComparisonRows
      .filter((row) => {
        if (detailGroupFilter !== "all" && row.groupId !== detailGroupFilter) return false;

        if (!term) return true;
        return normalizeText(`${row.categoryName} ${row.groupLabel} ${row.type}`).includes(term);
      })
      .sort((a, b) => {
        const groupOrder = (groupId) => {
          const index = DRE_GROUPS.findIndex((group) => group.id === groupId);
          return index === -1 ? 99 : index;
        };

        const byGroup = groupOrder(a.groupId) - groupOrder(b.groupId);
        if (byGroup !== 0) return byGroup;
        if (b.currentAmount !== a.currentAmount) return b.currentAmount - a.currentAmount;
        return a.categoryName.localeCompare(b.categoryName, "pt-BR");
      });
  }, [categoryComparisonRows, detailGroupFilter, detailSearch]);

  const detailTotalPages = Math.max(1, Math.ceil(filteredDetailRows.length / detailPageSize));
  const detailPaginationItems = useMemo(
    () => buildPagination(detailPage, detailTotalPages),
    [detailPage, detailTotalPages]
  );
  const pagedDetailRows = useMemo(() => {
    const start = (detailPage - 1) * detailPageSize;
    return filteredDetailRows.slice(start, start + detailPageSize);
  }, [detailPage, detailPageSize, filteredDetailRows]);

  useEffect(() => {
    setDetailPage(1);
  }, [detailGroupFilter, detailPageSize, detailSearch]);

  useEffect(() => {
    if (detailPage > detailTotalPages) setDetailPage(detailTotalPages);
  }, [detailPage, detailTotalPages]);

  const categoryUsage = useMemo(() => {
    const map = new Map();
    movements.forEach((movement) => {
      if (!movement.categoria_id) return;
      map.set(movement.categoria_id, (map.get(movement.categoria_id) || 0) + 1);
    });
    return map;
  }, [movements]);

  const filteredCategories = useMemo(() => {
    const term = normalizeText(categorySearch);

    return categories.filter((category) => {
      const normalizedGroup = normalizeGroupId(category.grupo_dre);

      if (categoryTypeFilter !== "all" && category.tipo !== categoryTypeFilter) return false;
      if (categoryGroupFilter !== "all") {
        if (categoryGroupFilter === "unclassified") {
          if (normalizedGroup) return false;
        } else if (normalizedGroup !== categoryGroupFilter) {
          return false;
        }
      }
      if (categoryStatusFilter === "active" && !category.ativo) return false;
      if (categoryStatusFilter === "inactive" && category.ativo) return false;

      if (!term) return true;
      return normalizeText(`${category.nome} ${category.grupo_dre || ""}`).includes(term);
    });
  }, [categories, categoryGroupFilter, categorySearch, categoryStatusFilter, categoryTypeFilter]);

  const categoryTotalPages = Math.max(1, Math.ceil(filteredCategories.length / categoryPageSize));
  const categoryPaginationItems = useMemo(
    () => buildPagination(categoryPage, categoryTotalPages),
    [categoryPage, categoryTotalPages]
  );
  const pagedCategories = useMemo(() => {
    const start = (categoryPage - 1) * categoryPageSize;
    return filteredCategories.slice(start, start + categoryPageSize);
  }, [categoryPage, categoryPageSize, filteredCategories]);

  useEffect(() => {
    setCategoryPage(1);
  }, [categoryGroupFilter, categoryPageSize, categorySearch, categoryStatusFilter, categoryTypeFilter]);

  useEffect(() => {
    if (categoryPage > categoryTotalPages) setCategoryPage(categoryTotalPages);
  }, [categoryPage, categoryTotalPages]);

  const categoriesWithoutValidGroup = useMemo(
    () =>
      categories.filter((category) => {
        const group = getGroupById(normalizeGroupId(category.grupo_dre));
        return !group || group.type !== category.tipo;
      }),
    [categories]
  );

  const hasDetailFilters = detailSearch || detailGroupFilter !== "all";
  const hasCategoryFilters =
    categorySearch ||
    categoryTypeFilter !== "all" ||
    categoryGroupFilter !== "all" ||
    categoryStatusFilter !== "active";

  function resetDetailFilters() {
    setDetailSearch("");
    setDetailGroupFilter("all");
  }

  function resetCategoryFilters() {
    setCategorySearch("");
    setCategoryTypeFilter("all");
    setCategoryGroupFilter("all");
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
      console.warn("Auditoria do DRE não registrada", auditError);
    }
  }

  function openCreateCategory(type = "despesa") {
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
      grupo_dre: getGroupById(normalizeGroupId(category.grupo_dre))?.label || "",
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
    const selectedGroup = DRE_GROUPS.find((group) => group.label === categoryForm.grupo_dre);

    if (!cleanText(categoryForm.nome)) {
      nextErrors.nome = "Informe o nome da categoria.";
    }

    if (!selectedGroup) {
      nextErrors.grupo_dre = "Selecione um grupo válido do DRE.";
    } else if (selectedGroup.type !== categoryForm.tipo) {
      nextErrors.grupo_dre =
        categoryForm.tipo === "receita"
          ? "Receitas só podem usar grupos de receita."
          : "Despesas só podem usar grupos de custo ou despesa.";
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
      grupo_dre: categoryForm.grupo_dre,
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
              "Essa categoria já possui lançamentos. Crie uma nova categoria para trocar de receita para despesa sem alterar o histórico."
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
          description: `Classificação DRE da categoria ${data.nome} atualizada.`,
          before,
          after: data,
        });

        toast.success("Categoria atualizada", "A classificação do DRE foi salva.");
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
          description: `Categoria financeira ${data.nome} criada pelo módulo DRE.`,
          after: data,
        });

        toast.success("Categoria criada", "Ela já pode ser usada no Financeiro e no DRE.");
      }

      setCategoryOpen(false);
      setEditingCategory(null);
      setCategoryErrors({});
      await loadData({ silent: true });
    } catch (saveError) {
      console.error("Salvar categoria DRE", saveError);
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
        description: `Categoria financeira ${deleteCategoryTarget.nome} excluída pelo módulo DRE.`,
        before,
      });

      toast.success(
        "Categoria excluída",
        "Os lançamentos são preservados, mas registros vinculados podem ficar sem categoria."
      );
      setDeleteCategoryTarget(null);
      await loadData({ silent: true });
    } catch (deleteError) {
      console.error("Excluir categoria DRE", deleteError);
      toast.error("Não foi possível excluir", deleteError?.message || "Tente novamente.");
    } finally {
      setDeletingCategory(false);
    }
  }

  function exportCsv() {
    if (!movements.length) {
      toast.info("Nada para exportar", "O período selecionado não possui movimentações.");
      return;
    }

    const summaryRows = [
      ["DRE", "Valor atual", comparePrevious ? "Período anterior" : ""],
      ["Receita operacional", snapshot.operatingRevenue, previousSnapshot.operatingRevenue],
      ["(-) Custos diretos", snapshot.directCosts, previousSnapshot.directCosts],
      ["Resultado bruto", snapshot.grossResult, previousSnapshot.grossResult],
      ["(-) Despesas operacionais", snapshot.operatingExpenses, previousSnapshot.operatingExpenses],
      ["Resultado operacional", snapshot.operatingResult, previousSnapshot.operatingResult],
      ["(+) Outras receitas", snapshot.otherRevenue, previousSnapshot.otherRevenue],
      ["(-) Outras despesas", snapshot.otherExpenses, previousSnapshot.otherExpenses],
      ["(+) Receitas sem classificação", snapshot.unclassifiedRevenue, previousSnapshot.unclassifiedRevenue],
      ["(-) Despesas sem classificação", snapshot.unclassifiedExpense, previousSnapshot.unclassifiedExpense],
      ["RESULTADO LÍQUIDO", snapshot.netResult, previousSnapshot.netResult],
      ["Margem líquida", `${snapshot.margin.toFixed(2).replace(".", ",")}%`, `${previousSnapshot.margin.toFixed(2).replace(".", ",")}%`],
    ];

    const detailHeader = [
      "Categoria",
      "Grupo DRE",
      "Tipo",
      "Lançamentos",
      "Valor atual",
      "Valor anterior",
      "Participação",
    ];

    const detailRows = categoryComparisonRows.map((row) => [
      row.categoryName,
      row.groupLabel,
      row.type === "receita" ? "Receita" : "Despesa",
      row.count,
      safeNumber(row.currentAmount).toFixed(2).replace(".", ","),
      safeNumber(row.previousAmount).toFixed(2).replace(".", ","),
      `${safeNumber(row.participation).toFixed(2).replace(".", ",")}%`,
    ]);

    const metadata = [
      ["Período", periodLabel],
      ["Regime", "Competência"],
      ["Moeda", currency],
      comparePrevious ? ["Comparação", previousPeriodLabel] : ["Comparação", "Desativada"],
      [],
    ];

    downloadCsvReport({
      filename: `dre_${from}_${to}.csv`,
      title: "PDR Hub - DRE",
      metadata: metadata.filter((row) => row.length),
      sections: [
        {
          title: "Resumo DRE",
          headers: summaryRows[0],
          rows: summaryRows.slice(1).map(([label, current, previous]) => [
            label,
            typeof current === "number" ? formatMoney(current) : current,
            typeof previous === "number" ? formatMoney(previous) : previous,
          ]),
        },
        {
          title: "Detalhamento por categoria",
          headers: detailHeader,
          rows: detailRows,
        },
      ],
    });

    toast.success("DRE exportado", "O arquivo CSV foi gerado com o resumo e o detalhamento.");
  }

  function printDre() {
    const statementRows = [
      ["Receita operacional", snapshot.operatingRevenue],
      ["(-) Custos diretos", snapshot.directCosts],
      ["Resultado bruto", snapshot.grossResult],
      ["(-) Despesas operacionais", snapshot.operatingExpenses],
      ["Resultado operacional", snapshot.operatingResult],
      ["(+) Outras receitas", snapshot.otherRevenue],
      ["(-) Outras despesas", snapshot.otherExpenses],
      ...(snapshot.unclassifiedRevenue
        ? [["(+) Receitas sem classificação", snapshot.unclassifiedRevenue]]
        : []),
      ...(snapshot.unclassifiedExpense
        ? [["(-) Despesas sem classificação", snapshot.unclassifiedExpense]]
        : []),
      ["RESULTADO LÍQUIDO", snapshot.netResult],
    ];

    const detailRows = categoryComparisonRows
      .filter((row) => row.currentAmount > 0)
      .sort((a, b) => b.currentAmount - a.currentAmount)
      .map((row) => [
        row.categoryName,
        row.groupLabel,
        row.type === "receita" ? "Receita" : "Despesa",
        formatMoney(row.currentAmount),
      ]);

    const opened = openPrintReport({
      title: "Demonstração do Resultado do Exercício",
      subtitle: me?.conta?.nome_fantasia || me?.conta?.nome || "PDR Hub",
      locale,
      metadata: [
        ["Período", periodLabel],
        ["Regime", "Competência"],
        ["Moeda", currency],
        comparePrevious ? ["Comparação", previousPeriodLabel] : ["Comparação", "Desativada"],
      ],
      summaryCards: [
        { label: "Receita total", value: formatMoney(snapshot.totalRevenue), tone: "success" },
        { label: "Despesas totais", value: formatMoney(snapshot.totalExpenses), tone: "danger" },
        {
          label: "Resultado líquido",
          value: formatMoney(snapshot.netResult),
          tone: snapshot.netResult >= 0 ? "success" : "danger",
        },
        { label: "Margem líquida", value: formatPercent(snapshot.margin) },
      ],
      sections: [
        {
          title: "Demonstrativo",
          headers: ["Linha", "Valor"],
          rows: statementRows.map(([label, value], index) => ({
            cells: [label, formatMoney(value)],
            tone: index === statementRows.length - 1 ? "result" : "",
          })),
          numericColumns: [1],
        },
        {
          title: "Detalhamento por categoria",
          headers: ["Categoria", "Grupo DRE", "Tipo", "Valor"],
          rows: detailRows,
          numericColumns: [3],
        },
      ],
    });

    if (!opened) {
      toast.warning(
        "Pop-up bloqueado",
        "Permita pop-ups para esta página e tente novamente para imprimir ou salvar em PDF."
      );
    }
  }

  const detailColumns = [
    {
      key: "categoryName",
      header: "Categoria",
      render: (value, row) => (
        <div className="flex min-w-[210px] items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <div>
            <p className="font-medium text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.count} lançamento(s) no período
              {row.implicit ? " · classificação automática" : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "groupLabel",
      header: "Grupo DRE",
      render: (_, row) => <GroupBadge groupId={row.groupId} />,
    },
    {
      key: "type",
      header: "Tipo",
      render: (value) => <TypeBadge type={value} />,
    },
    {
      key: "currentAmount",
      header: "Período",
      align: "right",
      render: (value, row) => (
        <span className={`whitespace-nowrap font-semibold ${row.type === "receita" ? "text-success" : "text-foreground"}`}>
          {row.type === "despesa" ? "- " : "+ "}
          {formatMoney(value)}
        </span>
      ),
    },
    ...(comparePrevious
      ? [
          {
            key: "previousAmount",
            header: "Anterior",
            align: "right",
            render: (value) => (
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                {formatMoney(value)}
              </span>
            ),
          },
          {
            key: "variation",
            header: "Variação",
            align: "right",
            render: (_, row) => (
              <DeltaBadge
                current={row.currentAmount}
                previous={row.previousAmount}
                invert={row.type === "despesa"}
              />
            ),
          },
        ]
      : []),
    {
      key: "participation",
      header: "Participação",
      align: "right",
      render: (value) => (
        <span className="whitespace-nowrap text-sm font-medium text-foreground">
          {formatPercent(value)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (_, row) =>
        row.categoryId ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const category = categories.find((item) => item.id === row.categoryId);
              if (category) openEditCategory(category);
            }}
            aria-label="Editar classificação da categoria"
            title="Editar classificação da categoria"
          >
            <Pencil className="size-4" strokeWidth={1.8} />
          </Button>
        ) : null,
    },
  ];

  const categoryColumns = [
    {
      key: "nome",
      header: "Categoria",
      render: (value, row) => (
        <div className="flex min-w-[190px] items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: safeHex(row.cor) }}
          />
          <div>
            <p className="font-medium text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
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
      render: (value, row) => {
        const groupId = normalizeGroupId(value);
        const group = getGroupById(groupId);
        const invalid = !group || group.type !== row.tipo;

        return invalid ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5" strokeWidth={1.9} />
            {value || "Não definido"}
          </span>
        ) : (
          <GroupBadge groupId={groupId} />
        );
      },
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

  const groupOptionsForCategory = DRE_GROUPS.filter(
    (group) => group.type === categoryForm.tipo
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Resultado econômico por competência, organizado pelas categorias do Financeiro.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            DRE
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
            disabled={!movements.length}
          >
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            leftIcon={Printer}
            onClick={printDre}
            disabled={!movements.length}
          >
            Imprimir / PDF
          </Button>
          <Button
            leftIcon={Tags}
            onClick={() => setActiveTab("classification")}
          >
            Classificação DRE
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <Filter className="size-4" strokeWidth={1.8} />
            </span>
            Período
          </div>

          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={preset} onChange={(event) => changePreset(event.target.value)}>
              <option value="month">Este mês</option>
              <option value="previous_month">Mês anterior</option>
              <option value="quarter">Este trimestre</option>
              <option value="year">Este ano</option>
              <option value="custom">Período personalizado</option>
            </Select>

            <DateInput
              value={from}
              onChange={(event) => {
                setPreset("custom");
                setFrom(event.target.value);
              }}
            />

            <DateInput
              value={to}
              onChange={(event) => {
                setPreset("custom");
                setTo(event.target.value);
              }}
            />

            <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
              <Switch
                id="dre-compare-previous"
                checked={comparePrevious}
                onCheckedChange={setComparePrevious}
              />
              <label
                htmlFor="dre-compare-previous"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Comparar período anterior
              </label>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Regime: <strong className="font-semibold text-foreground">competência</strong>
          </span>
          <span>
            Período atual: <strong className="font-semibold text-foreground">{periodLabel}</strong>
          </span>
          {comparePrevious ? (
            <span>
              Comparação: <strong className="font-semibold text-foreground">{previousPeriodLabel}</strong>
            </span>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </section>
      ) : null}

      {loading ? (
        <LoadingCards />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Receita total"
            value={formatMoney(snapshot.totalRevenue)}
            caption={
              comparePrevious
                ? `Anterior: ${formatMoney(previousSnapshot.totalRevenue)}`
                : `${snapshot.totalMovements} lançamentos no período`
            }
            icon={TrendingUp}
            tone="success"
          />
          <MetricCard
            label="Custos diretos"
            value={formatMoney(snapshot.directCosts)}
            caption={
              comparePrevious
                ? `Anterior: ${formatMoney(previousSnapshot.directCosts)}`
                : "Custos ligados diretamente aos serviços"
            }
            icon={ArrowDownRight}
            tone={snapshot.directCosts ? "danger" : "primary"}
          />
          <MetricCard
            label="Despesas operacionais"
            value={formatMoney(snapshot.operatingExpenses)}
            caption={
              comparePrevious
                ? `Anterior: ${formatMoney(previousSnapshot.operatingExpenses)}`
                : "Estrutura e rotina operacional"
            }
            icon={FileText}
            tone={snapshot.operatingExpenses ? "warning" : "primary"}
          />
          <MetricCard
            label="Resultado líquido"
            value={formatMoney(snapshot.netResult)}
            caption={
              comparePrevious
                ? `Anterior: ${formatMoney(previousSnapshot.netResult)}`
                : "Receitas menos custos e despesas"
            }
            icon={Sigma}
            tone={snapshot.netResult < 0 ? "danger" : "success"}
          />
          <MetricCard
            label="Margem líquida"
            value={formatPercent(snapshot.margin)}
            caption={`${formatPercent(snapshot.classificationCoverage)} dos lançamentos classificados`}
            icon={Percent}
            tone={snapshot.margin < 0 ? "danger" : "primary"}
          />
        </section>
      )}

      {!loading && (snapshot.unclassifiedCount > 0 || categoriesWithoutValidGroup.length > 0) ? (
        <section className="rounded-xl border border-warning/30 bg-warning/10 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
                <TriangleAlert className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="font-semibold text-foreground">Existem itens para revisar no DRE</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {snapshot.unclassifiedCount > 0
                    ? `${snapshot.unclassifiedCount} lançamento(s) do período não possuem uma classificação DRE válida. `
                    : ""}
                  {categoriesWithoutValidGroup.length > 0
                    ? `${categoriesWithoutValidGroup.length} categoria(s) estão sem grupo válido ou com grupo incompatível com o tipo.`
                    : ""}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              leftIcon={Tags}
              onClick={() => setActiveTab("classification")}
            >
              Revisar classificação
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-2">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "statement", label: "Demonstrativo", icon: BarChart3 },
            { id: "classification", label: "Classificação DRE", icon: Layers3 },
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

      {activeTab === "statement" ? (
        <>
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                    <BarChart3 className="size-4" strokeWidth={1.8} />
                  </span>
                  Demonstração do Resultado
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Valores reconhecidos pela data de competência, independentemente de já terem sido pagos ou recebidos.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                <CalendarRange className="size-4" strokeWidth={1.8} />
                {periodLabel}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[650px] grid-cols-[minmax(260px,1fr)_160px_160px_100px] gap-3 border-b border-border bg-surface-2/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
                <span>Conta</span>
                <span className="text-right">Período</span>
                <span className="text-right">Anterior</span>
                <span className="text-right">Variação</span>
              </div>

              <div className="divide-y divide-border">
                <StatementRow
                  label="Receita operacional"
                  value={snapshot.operatingRevenue}
                  previousValue={previousSnapshot.operatingRevenue}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  sign="+"
                />
                <StatementRow
                  label="Custos diretos"
                  value={snapshot.directCosts}
                  previousValue={previousSnapshot.directCosts}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  sign="−"
                  invertDelta
                />
                <StatementRow
                  label="Resultado bruto"
                  value={snapshot.grossResult}
                  previousValue={previousSnapshot.grossResult}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  kind="subtotal"
                  sign="="
                />
                <StatementRow
                  label="Despesas operacionais"
                  value={snapshot.operatingExpenses}
                  previousValue={previousSnapshot.operatingExpenses}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  sign="−"
                  invertDelta
                />
                <StatementRow
                  label="Resultado operacional"
                  value={snapshot.operatingResult}
                  previousValue={previousSnapshot.operatingResult}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  kind="subtotal"
                  sign="="
                />
                <StatementRow
                  label="Outras receitas"
                  value={snapshot.otherRevenue}
                  previousValue={previousSnapshot.otherRevenue}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  sign="+"
                />
                <StatementRow
                  label="Outras despesas"
                  value={snapshot.otherExpenses}
                  previousValue={previousSnapshot.otherExpenses}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  sign="−"
                  invertDelta
                />

                {snapshot.unclassifiedRevenue > 0 || previousSnapshot.unclassifiedRevenue > 0 ? (
                  <StatementRow
                    label="Receitas sem classificação DRE"
                    value={snapshot.unclassifiedRevenue}
                    previousValue={previousSnapshot.unclassifiedRevenue}
                    compare={comparePrevious}
                    formatMoney={formatMoney}
                    sign="+"
                  />
                ) : null}

                {snapshot.unclassifiedExpense > 0 || previousSnapshot.unclassifiedExpense > 0 ? (
                  <StatementRow
                    label="Despesas sem classificação DRE"
                    value={snapshot.unclassifiedExpense}
                    previousValue={previousSnapshot.unclassifiedExpense}
                    compare={comparePrevious}
                    formatMoney={formatMoney}
                    sign="−"
                    invertDelta
                  />
                ) : null}

                <StatementRow
                  label="RESULTADO LÍQUIDO"
                  value={snapshot.netResult}
                  previousValue={previousSnapshot.netResult}
                  compare={comparePrevious}
                  formatMoney={formatMoney}
                  kind="result"
                  sign="="
                />
              </div>
            </div>

            <div className="grid gap-3 border-t border-border bg-background p-4 sm:grid-cols-3 sm:p-5">
              <div>
                <p className="text-xs text-muted-foreground">Receitas totais</p>
                <p className="mt-1 font-semibold text-success">{formatMoney(snapshot.totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custos + despesas</p>
                <p className="mt-1 font-semibold text-foreground">{formatMoney(snapshot.totalExpenses)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem líquida</p>
                <p className={`mt-1 font-semibold ${snapshot.margin < 0 ? "text-danger" : "text-foreground"}`}>
                  {formatPercent(snapshot.margin)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                  <Search className="size-4" strokeWidth={1.8} />
                </span>
                Detalhamento
              </div>

              <div className="grid flex-1 gap-2 md:grid-cols-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                  <Input
                    value={detailSearch}
                    onChange={(event) => setDetailSearch(event.target.value)}
                    placeholder="Buscar categoria ou grupo..."
                    className="pl-9"
                  />
                </div>

                <Select
                  value={detailGroupFilter}
                  onChange={(event) => setDetailGroupFilter(event.target.value)}
                >
                  <option value="all">Todos os grupos</option>
                  {DRE_GROUPS.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                  <option value="sem_classificacao_receita">Receitas sem classificação</option>
                  <option value="sem_classificacao_despesa">Despesas sem classificação</option>
                </Select>
              </div>

              {hasDetailFilters ? (
                <Button variant="ghost" leftIcon={X} onClick={resetDetailFilters}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </section>

          <Table
            data={pagedDetailRows}
            columns={detailColumns}
            loading={loading}
            emptyTitle="Nenhum valor encontrado no DRE"
            emptyDescription={
              hasDetailFilters
                ? "Ajuste os filtros para visualizar outras categorias."
                : "Os lançamentos financeiros do período aparecerão aqui agrupados por categoria."
            }
          />

          {!loading ? (
            <PaginationBar
              page={detailPage}
              pageSize={detailPageSize}
              totalItems={filteredDetailRows.length}
              totalPages={detailTotalPages}
              paginationItems={detailPaginationItems}
              onPageChange={setDetailPage}
              onPageSizeChange={setDetailPageSize}
            />
          ) : null}
        </>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                    <Layers3 className="size-4" strokeWidth={1.8} />
                  </span>
                  Estrutura de classificação
                </div>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  O DRE usa o campo <strong className="font-semibold text-foreground">grupo_dre</strong> das categorias financeiras. Os cinco grupos abaixo são fixos no front e não exigem uma tabela adicional.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  leftIcon={Plus}
                  onClick={() => openCreateCategory("receita")}
                >
                  Categoria de receita
                </Button>
                <Button leftIcon={Plus} onClick={() => openCreateCategory("despesa")}>
                  Categoria de despesa
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {DRE_GROUPS.map((group) => {
                const count = categories.filter((category) => {
                  const groupId = normalizeGroupId(category.grupo_dre);
                  return groupId === group.id && category.tipo === group.type;
                }).length;

                return (
                  <div key={group.id} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                    <p className="mt-3 text-xs font-medium text-foreground">
                      {count} categoria(s)
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                  <Filter className="size-4" strokeWidth={1.8} />
                </span>
                Categorias
              </div>

              <div className="grid flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                  <Input
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Buscar categoria..."
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
                  value={categoryGroupFilter}
                  onChange={(event) => setCategoryGroupFilter(event.target.value)}
                >
                  <option value="all">Todos os grupos DRE</option>
                  {DRE_GROUPS.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                  <option value="unclassified">Sem classificação válida</option>
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
            </div>
          </section>

          <Table
            data={pagedCategories}
            columns={categoryColumns}
            loading={loading}
            emptyTitle="Nenhuma categoria encontrada"
            emptyDescription="Crie ou ajuste categorias para organizar corretamente o DRE."
          />

          {!loading ? (
            <PaginationBar
              page={categoryPage}
              pageSize={categoryPageSize}
              totalItems={filteredCategories.length}
              totalPages={categoryTotalPages}
              paginationItems={categoryPaginationItems}
              onPageChange={setCategoryPage}
              onPageSizeChange={setCategoryPageSize}
            />
          ) : null}
        </>
      )}

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
              form="dre-category-form"
              loading={savingCategory}
              leftIcon={editingCategory ? Pencil : Plus}
            >
              {editingCategory ? "Salvar alterações" : "Criar categoria"}
            </Button>
          </div>
        }
      >
        <Form id="dre-category-form" onSubmit={handleSaveCategory}>
          <FormSection
            title="Classificação"
            description="A categoria continuará sendo a mesma do Financeiro; aqui você define como ela entra no DRE."
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
                    const nextDefaultGroup =
                      nextType === "receita" ? "Receita operacional" : "Despesas operacionais";

                    setCategoryForm((current) => ({
                      ...current,
                      tipo: nextType,
                      grupo_dre: nextDefaultGroup,
                      cor:
                        editingCategory ||
                        (current.cor !== "#16A269" && current.cor !== "#DC4C4C")
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

              <FormField label="Grupo DRE" required error={categoryErrors.grupo_dre}>
                <Select
                  value={categoryForm.grupo_dre}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      grupo_dre: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione o grupo</option>
                  {groupOptionsForCategory.map((group) => (
                    <option key={group.id} value={group.label}>
                      {group.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FormGrid>

            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
              {getGroupById(normalizeGroupId(categoryForm.grupo_dre))?.description ||
                "Selecione um grupo para definir onde a categoria será apresentada no demonstrativo."}
            </div>
          </FormSection>

          <FormSection
            title="Cor"
            description="A cor é compartilhada com o Financeiro e funciona apenas como marcador visual."
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
                      name="dre-category-color"
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

          <FormSection
            title="Disponibilidade"
            description="Categorias inativas permanecem no histórico, mas deixam de aparecer para novos lançamentos."
          >
            <FormField label="Categoria ativa">
              <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
                <Switch
                  id="dre-category-active"
                  checked={categoryForm.ativo}
                  onCheckedChange={(checked) =>
                    setCategoryForm((current) => ({ ...current, ativo: checked }))
                  }
                />
                <label
                  htmlFor="dre-category-active"
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
        description="A categoria será removida, mas as movimentações financeiras serão preservadas."
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
              Ela aparece em {categoryUsage.get(deleteCategoryTarget?.id)} lançamento(s) do período selecionado. Esses registros continuarão existindo, mas poderão ficar sem categoria e exigir revisão no DRE.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
