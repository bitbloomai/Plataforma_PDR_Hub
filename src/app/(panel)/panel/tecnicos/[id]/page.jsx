"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Banknote,
  Building2,
  CalendarRange,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileText,
  Filter,
  Globe2,
  Landmark,
  Mail,
  Pencil,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  UserRound,
  UserX,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

import {
  Button,
  DateInput,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Modal,
  SearchableSelect,
  Select,
  Textarea,
} from "@/components/shared";
import { TechnicianDeleteModal } from "@/components/tecnicos/technician-delete-modal";
import { TechnicianFormModal } from "@/components/tecnicos/technician-form-modal";
import {
  Avatar,
  CountryBadge,
  InfoItem,
  MetricCard,
  StatusBadge,
} from "@/components/tecnicos/technician-ui";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayMoney, moneyFromStorage, withSourceCurrency } from "@/lib/currency";
import { localISO, todayISO } from "@/lib/dates";
import { downloadExcelReport, openPrintReport } from "@/lib/exportReports";
import {
  formatDateByConfig,
  formatDateTimeByConfig,
  formatPersonDocument,
  formatPhone,
} from "@/lib/formatters";
import {
  PAYMENT_TYPE_LABELS,
  TECHNICIAN_SELECT,
  cleanText,
  countryMeta,
  fetchMe,
  getPhotoUrl,
  isPaidStatus,
  logAudit,
  normalizeText,
  resolveDocumentCountry,
  resolvePhoneCountry,
  safeNumber,
  vehicleIdentifier,
  vehicleName,
} from "@/lib/technicians";
import { toast } from "@/lib/toast";

const PAGE_SIZES = [25, 50, 100];

const SERVICE_STATUS_META = {
  agendado: { label: "Agendado", badgeClass: "bg-warning/10 text-warning" },
  em_andamento: { label: "Em andamento", badgeClass: "bg-primary/12 text-foreground" },
  concluido: { label: "Concluído", badgeClass: "bg-success/10 text-success" },
  cancelado: { label: "Cancelado", badgeClass: "bg-danger/10 text-danger" },
};

const PERIOD_OPTIONS = [
  { value: "week", label: "Esta semana" },
  { value: "previous_week", label: "Semana anterior" },
  { value: "month", label: "Este mês" },
  { value: "previous_month", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "all", label: "Todo o histórico" },
  { value: "custom", label: "Período personalizado" },
];

const MOVEMENT_SELECT =
  "id,servico_id,tecnico_id,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,observacoes";

function getPresetRange(preset, timezone) {
  const today = new Date(`${todayISO(timezone)}T12:00:00`);

  if (preset === "all") return { from: "", to: "" };

  if (preset === "week" || preset === "previous_week") {
    const offset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - offset - (preset === "previous_week" ? 7 : 0));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: localISO(monday), to: localISO(sunday) };
  }

  if (preset === "previous_month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localISO(first), to: localISO(last) };
  }

  if (preset === "year") {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }

  return {
    from: localISO(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
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

function paymentDetails(technician) {
  if (!technician?.pagamento_tipo) return [];

  const details = [["Forma", PAYMENT_TYPE_LABELS[technician.pagamento_tipo] || "Outro"]];
  if (technician.titular_pagamento) details.push(["Titular", technician.titular_pagamento]);

  if (technician.pagamento_tipo === "pix" && technician.chave_pix) {
    details.push(["Chave PIX", technician.chave_pix]);
  }

  if (technician.pagamento_tipo === "conta_br") {
    if (technician.banco_nome) details.push(["Banco", technician.banco_nome]);
    if (technician.agencia) details.push(["Agência", technician.agencia]);
    if (technician.conta_bancaria) details.push(["Conta", technician.conta_bancaria]);
  }

  if (technician.pagamento_tipo === "iban") {
    if (technician.banco_nome) details.push(["Banco", technician.banco_nome]);
    if (technician.iban) details.push(["IBAN", technician.iban]);
    if (technician.bic_swift) details.push(["BIC / SWIFT", technician.bic_swift]);
  }

  return details;
}

function ServiceStatusBadge({ status }) {
  const meta = SERVICE_STATUS_META[status] || {
    label: status || "Sem status",
    badgeClass: "bg-surface-2 text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

function RepasseBadge({ row, formatDate }) {
  if (row.cancelled) {
    return <span className="text-xs text-muted-foreground">Sem repasse</span>;
  }

  if (!row.movement) {
    return (
      <span
        className="inline-flex items-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground"
        title="Este serviço não possui lançamento financeiro de repasse."
      >
        Sem lançamento
      </span>
    );
  }

  if (row.paid) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <Check className="size-3" strokeWidth={2.4} />
          Pago
        </span>
        {row.movement.data_pagamento ? (
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            em {formatDate(row.movement.data_pagamento)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
      <span className="size-1.5 rounded-full bg-warning" />
      A repassar
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex gap-4">
          <div className="size-24 animate-pulse rounded-full bg-surface-2" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-5 w-48 animate-pulse rounded-full bg-surface-2" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}

export default function TecnicoDetalhePage() {
  const params = useParams();
  const technicianId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);
  const rangeReadyRef = useRef(false);

  const [me, setMe] = useState(null);
  const [technician, setTechnician] = useState(null);
  const [offices, setOffices] = useState([]);
  const [links, setLinks] = useState([]);
  const [relations, setRelations] = useState([]);
  const [movements, setMovements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [periodPreset, setPeriodPreset] = useState("month");
  const [dateFrom, setDateFrom] = useState(() => getPresetRange("month").from);
  const [dateTo, setDateTo] = useState(() => getPresetRange("month").to);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("valid");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [paymentRows, setPaymentRows] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    data_pagamento: "",
    forma_pagamento: "",
    observacoes: "",
  });
  const [paying, setPaying] = useState(false);

  const [reopenTarget, setReopenTarget] = useState(null);
  const [reopening, setReopening] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [officesOpen, setOfficesOpen] = useState(false);
  const [officeSearch, setOfficeSearch] = useState("");
  const [mutatingOfficeId, setMutatingOfficeId] = useState("");

  const config = me?.configuracao;
  const contaId = me?.usuario?.conta_id || "";
  const usuarioId = me?.usuario?.id || "";
  const timezone = config?.timezone || "Europe/Rome";
  const locale = config?.locale || "it-IT";

  const formatMoney = useCallback(
    (value, sourceCurrency) =>
      formatDisplayMoney(value, withSourceCurrency(config, sourceCurrency || config?.moeda)),
    [config]
  );

  const moneyValue = useCallback(
    (value, sourceCurrency) =>
      moneyFromStorage(value, withSourceCurrency(config, sourceCurrency), sourceCurrency),
    [config]
  );

  const formatDate = useCallback(
    (value) => (value ? formatDateByConfig(value, config) : ""),
    [config]
  );

  const formatPercent = useCallback(
    (value) =>
      `${safeNumber(value).toLocaleString(locale, { maximumFractionDigits: 2 })}%`,
    [locale]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!technicianId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const meData = meRef.current || (await fetchMe());
        meRef.current = meData;
        const currentContaId = meData?.usuario?.conta_id;

        if (!currentContaId) throw new Error("Usuário sem conta vinculada.");

        const [
          technicianResult,
          officesResult,
          linksResult,
          relationsResult,
          movementsResult,
        ] = await Promise.all([
          supabase
            .from("tecnicos")
            .select(TECHNICIAN_SELECT)
            .eq("conta_id", currentContaId)
            .eq("id", technicianId)
            .maybeSingle(),
          supabase
            .from("oficinas")
            .select("id,conta_id,nome,cidade,estado_regiao,pais,ativo")
            .eq("conta_id", currentContaId)
            .order("ativo", { ascending: false })
            .order("nome", { ascending: true })
            .range(0, 4999),
          supabase
            .from("oficinas_martelinhos")
            .select(
              "id,conta_id,oficina_id,tecnico_id,created_at,oficina:oficinas(id,nome,cidade,estado_regiao,pais,ativo)"
            )
            .eq("conta_id", currentContaId)
            .eq("tecnico_id", technicianId)
            .range(0, 4999),
          supabase
            .from("servicos_tecnicos")
            .select(
              `
                id,
                percentual,
                valor_repasse,
                moeda,
                created_at,
                servico:servicos!inner(
                  id,
                  data_servico,
                  valor,
                  moeda,
                  status,
                  descricao,
                  oficina_id,
                  veiculo_id,
                  created_at,
                  oficina:oficinas(id,nome,cidade,pais),
                  veiculo:veiculos(id,placa,chassi,marca,modelo,ano,cor),
                  servicos_tecnicos(id,tecnico_id)
                )
              `
            )
            .eq("conta_id", currentContaId)
            .eq("tecnico_id", technicianId)
            .range(0, 9999),
          supabase
            .from("movimentacoes_financeiras")
            .select(MOVEMENT_SELECT)
            .eq("conta_id", currentContaId)
            .eq("tecnico_id", technicianId)
            .eq("origem", "repasse_tecnico")
            .range(0, 9999),
        ]);

        if (technicianResult.error) throw technicianResult.error;
        if (officesResult.error) throw officesResult.error;
        if (linksResult.error) throw linksResult.error;
        if (relationsResult.error) throw relationsResult.error;
        if (movementsResult.error) throw movementsResult.error;

        // Na primeira carga, recalcula o período padrão no fuso configurado da conta.
        if (!rangeReadyRef.current) {
          rangeReadyRef.current = true;
          const range = getPresetRange("month", meData?.configuracao?.timezone);
          setDateFrom(range.from);
          setDateTo(range.to);
        }

        setMe(meData);
        setNotFound(!technicianResult.data);
        setTechnician(technicianResult.data || null);
        setOffices(officesResult.data || []);
        setLinks(linksResult.data || []);
        setRelations(relationsResult.data || []);
        setMovements(movementsResult.data || []);
      } catch (loadError) {
        console.error("Técnico detalhe", loadError);
        const message = loadError?.message || "Não foi possível carregar o técnico.";
        setError(message);
        toast.error("Não foi possível carregar", message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase, technicianId]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(frameId);
  }, [loadData]);

  const movementByService = useMemo(() => {
    const map = new Map();
    movements.forEach((movement) => {
      if (movement.servico_id && !map.has(movement.servico_id)) {
        map.set(movement.servico_id, movement);
      }
    });
    return map;
  }, [movements]);

  const rows = useMemo(
    () =>
      relations.map((relation) => {
        const service = relation.servico || {};
        const movement = movementByService.get(service.id) || null;
        const cancelled = service.status === "cancelado";
        const paid = Boolean(movement && isPaidStatus(movement.status));

        return {
          id: relation.id,
          serviceId: service.id,
          date: service.data_servico || "",
          createdAt: service.created_at || relation.created_at || "",
          status: service.status,
          cancelled,
          vehicle: service.veiculo || null,
          identifier: vehicleIdentifier(service.veiculo),
          office: service.oficina || null,
          officeId: service.oficina_id || "",
          description: service.descricao || "",
          serviceValue: moneyValue(service.valor, service.moeda),
          percent: safeNumber(relation.percentual),
          technicianValue: moneyValue(relation.valor_repasse, relation.moeda || service.moeda),
          sharedWith: Math.max(0, (service.servicos_tecnicos?.length || 1) - 1),
          movement,
          paid,
          payable: Boolean(movement && !paid && !cancelled),
        };
      }),
    [moneyValue, movementByService, relations]
  );

  const lifetime = useMemo(() => {
    const valid = rows.filter((row) => !row.cancelled);
    return {
      services: valid.length,
      generated: valid.reduce((sum, row) => sum + row.technicianValue, 0),
      pending: valid
        .filter((row) => !row.paid)
        .reduce((sum, row) => sum + row.technicianValue, 0),
      offices: new Set(valid.map((row) => row.officeId).filter(Boolean)).size,
    };
  }, [rows]);

  const officeOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      if (row.officeId) map.set(row.officeId, row.office?.nome || "Oficina");
    });
    links.forEach((link) => {
      if (link.oficina_id) map.set(link.oficina_id, link.oficina?.nome || "Oficina");
    });

    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "it", { sensitivity: "base" }));
  }, [links, rows]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(search);

    const result = rows.filter((row) => {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (officeFilter !== "all" && row.officeId !== officeFilter) return false;

      if (statusFilter === "valid" && row.cancelled) return false;
      if (!["valid", "all"].includes(statusFilter) && row.status !== statusFilter) return false;

      if (paymentFilter === "pending" && (row.paid || row.cancelled)) return false;
      if (paymentFilter === "paid" && !row.paid) return false;

      if (!term) return true;

      return normalizeText(
        [
          row.vehicle?.placa,
          row.vehicle?.chassi,
          row.vehicle?.marca,
          row.vehicle?.modelo,
          row.vehicle?.cor,
          row.office?.nome,
          row.description,
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(term);
    });

    const direction = sortDirection === "asc" ? 1 : -1;
    return result.sort((a, b) => {
      const byDate = String(a.date).localeCompare(String(b.date));
      if (byDate) return byDate * direction;
      return String(a.createdAt).localeCompare(String(b.createdAt)) * direction;
    });
  }, [dateFrom, dateTo, officeFilter, paymentFilter, rows, search, sortDirection, statusFilter]);

  const totals = useMemo(() => {
    const valid = filteredRows.filter((row) => !row.cancelled);
    const serviceValue = valid.reduce((sum, row) => sum + row.serviceValue, 0);
    const technicianValue = valid.reduce((sum, row) => sum + row.technicianValue, 0);
    const paid = valid
      .filter((row) => row.paid)
      .reduce((sum, row) => sum + row.technicianValue, 0);
    const payableRows = valid.filter((row) => row.payable);

    return {
      count: valid.length,
      vehicles: new Set(valid.map((row) => row.vehicle?.id).filter(Boolean)).size,
      offices: new Set(valid.map((row) => row.officeId).filter(Boolean)).size,
      serviceValue,
      technicianValue,
      paid,
      pending: technicianValue - paid,
      payableRows,
      payableValue: payableRows.reduce((sum, row) => sum + row.technicianValue, 0),
      averagePercent: serviceValue ? (technicianValue / serviceValue) * 100 : 0,
    };
  }, [filteredRows]);

  const officeBreakdown = useMemo(() => {
    const map = new Map();
    filteredRows
      .filter((row) => !row.cancelled)
      .forEach((row) => {
        const key = row.officeId || "sem-oficina";
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name: row.office?.nome || "Oficina não encontrada",
            count: 0,
            serviceValue: 0,
            technicianValue: 0,
            pending: 0,
          });
        }
        const entry = map.get(key);
        entry.count += 1;
        entry.serviceValue += row.serviceValue;
        entry.technicianValue += row.technicianValue;
        if (!row.paid) entry.pending += row.technicianValue;
      });

    return [...map.values()].sort((a, b) => b.technicianValue - a.technicianValue);
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPage(1));
    return () => cancelAnimationFrame(frame);
  }, [dateFrom, dateTo, officeFilter, statusFilter, paymentFilter, search, pageSize, sortDirection]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPage((current) => Math.min(current, totalPages));
    });
    return () => cancelAnimationFrame(frame);
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const paginationItems = useMemo(() => buildPagination(page, totalPages), [page, totalPages]);

  // A seleção só considera serviços visíveis no filtro atual e ainda pendentes.
  const selectedRows = useMemo(
    () => totals.payableRows.filter((row) => selectedIds.has(row.id)),
    [selectedIds, totals.payableRows]
  );
  const selectedValue = selectedRows.reduce((sum, row) => sum + row.technicianValue, 0);
  const allPayableSelected =
    totals.payableRows.length > 0 && selectedRows.length === totals.payableRows.length;

  const hasActiveFilters =
    periodPreset !== "month" ||
    officeFilter !== "all" ||
    statusFilter !== "valid" ||
    paymentFilter !== "all" ||
    Boolean(search);

  const periodLabel =
    dateFrom || dateTo
      ? `${dateFrom ? formatDate(dateFrom) : "Início"} a ${dateTo ? formatDate(dateTo) : "hoje"}`
      : "Todo o histórico";

  const officeFilterLabel =
    officeFilter === "all"
      ? "Todas as oficinas"
      : officeOptions.find((option) => option.value === officeFilter)?.label || "Oficina";

  function changePeriodPreset(preset) {
    setPeriodPreset(preset);
    if (preset === "custom") return;
    const range = getPresetRange(preset, timezone);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function resetFilters() {
    changePeriodPreset("month");
    setOfficeFilter("all");
    setStatusFilter("valid");
    setPaymentFilter("all");
    setSearch("");
  }

  function toggleRow(row) {
    if (!row.payable) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  function toggleAllPayable() {
    setSelectedIds(
      allPayableSelected ? new Set() : new Set(totals.payableRows.map((row) => row.id))
    );
  }

  function openPayment(rowsToPay) {
    if (!rowsToPay.length) {
      toast.warning(
        "Nada para repassar",
        "Não há serviços pendentes de repasse no filtro atual."
      );
      return;
    }

    setPaymentRows(rowsToPay);
    setPaymentForm({
      data_pagamento: todayISO(timezone),
      forma_pagamento: PAYMENT_TYPE_LABELS[technician?.pagamento_tipo] || "",
      observacoes: `Fechamento ${periodLabel}`,
    });
    setPaymentOpen(true);
  }

  async function confirmPayment(event) {
    event.preventDefault();
    if (!technician || !contaId || !paymentRows.length) return;

    if (!paymentForm.data_pagamento) {
      toast.warning("Informe a data", "Selecione a data em que o repasse foi pago.");
      return;
    }

    setPaying(true);

    try {
      const ids = paymentRows.map((row) => row.movement.id);
      const payload = {
        status: "pago",
        data_pagamento: paymentForm.data_pagamento,
        forma_pagamento: cleanText(paymentForm.forma_pagamento),
        updated_by: usuarioId || null,
        updated_at: new Date().toISOString(),
      };

      const note = cleanText(paymentForm.observacoes);
      if (note) payload.observacoes = note;

      const { data, error: updateError } = await supabase
        .from("movimentacoes_financeiras")
        .update(payload)
        .in("id", ids)
        .eq("conta_id", contaId)
        .eq("tecnico_id", technician.id)
        .eq("origem", "repasse_tecnico")
        .select(MOVEMENT_SELECT);

      if (updateError) throw updateError;

      const updated = new Map((data || []).map((movement) => [movement.id, movement]));
      setMovements((current) =>
        current.map((movement) => updated.get(movement.id) || movement)
      );

      const total = paymentRows.reduce((sum, row) => sum + row.technicianValue, 0);

      await logAudit(supabase, me, {
        entity: "movimentacoes_financeiras",
        action: "pagar",
        recordId: technician.id,
        description: `Fechamento de ${technician.nome}: ${updated.size} repasse(s) pagos, total ${formatMoney(total)} (${periodLabel}).`,
        after: {
          tecnico_id: technician.id,
          movimentacoes: [...updated.keys()],
          total,
          data_pagamento: payload.data_pagamento,
          forma_pagamento: payload.forma_pagamento,
          periodo: { de: dateFrom || null, ate: dateTo || null },
        },
      });

      toast.success(
        "Fechamento registrado",
        `${updated.size} repasse(s) marcados como pagos · ${formatMoney(total)}.`
      );

      setSelectedIds(new Set());
      setPaymentOpen(false);
      setPaymentRows([]);
    } catch (paymentError) {
      console.error("Fechamento técnico", paymentError);
      toast.error(
        "Não foi possível registrar o pagamento",
        paymentError?.message || "Tente novamente."
      );
    } finally {
      setPaying(false);
    }
  }

  async function confirmReopen() {
    if (!reopenTarget?.movement || !contaId) return;
    setReopening(true);

    try {
      const before = { ...reopenTarget.movement };
      const { data, error: updateError } = await supabase
        .from("movimentacoes_financeiras")
        .update({
          status: "pendente",
          data_pagamento: null,
          forma_pagamento: null,
          updated_by: usuarioId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reopenTarget.movement.id)
        .eq("conta_id", contaId)
        .select(MOVEMENT_SELECT)
        .single();

      if (updateError) throw updateError;

      setMovements((current) =>
        current.map((movement) => (movement.id === data.id ? data : movement))
      );

      await logAudit(supabase, me, {
        entity: "movimentacoes_financeiras",
        action: "reabrir",
        recordId: data.id,
        description: `Repasse de ${technician?.nome || "técnico"} (${reopenTarget.identifier || "veículo"}) voltou para pendente.`,
        before,
        after: data,
      });

      toast.success("Pagamento desfeito", "O repasse voltou para a lista de pendentes.");
      setReopenTarget(null);
    } catch (reopenError) {
      console.error("Reabrir repasse", reopenError);
      toast.error("Não foi possível desfazer", reopenError?.message || "Tente novamente.");
    } finally {
      setReopening(false);
    }
  }

  const linkedOfficeIds = useMemo(() => new Set(links.map((link) => link.oficina_id)), [links]);

  const pickerOffices = useMemo(() => {
    const term = normalizeText(officeSearch);

    return offices
      .filter((office) => office.ativo || linkedOfficeIds.has(office.id))
      .filter((office) => {
        if (!term) return true;
        return normalizeText(
          [office.nome, office.cidade, office.estado_regiao, office.pais].filter(Boolean).join(" ")
        ).includes(term);
      })
      .sort((a, b) => {
        const aSelected = linkedOfficeIds.has(a.id);
        const bSelected = linkedOfficeIds.has(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return String(a.nome || "").localeCompare(String(b.nome || ""), "it", {
          sensitivity: "base",
        });
      });
  }, [linkedOfficeIds, officeSearch, offices]);

  async function toggleOffice(office) {
    if (!technician || !contaId || mutatingOfficeId) return;

    const existing = links.find((link) => link.oficina_id === office.id);
    setMutatingOfficeId(office.id);

    try {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("oficinas_martelinhos")
          .delete()
          .eq("id", existing.id)
          .eq("conta_id", contaId);

        if (deleteError) throw deleteError;

        setLinks((current) => current.filter((link) => link.id !== existing.id));

        await logAudit(supabase, me, {
          action: "desvincular_oficina",
          recordId: technician.id,
          description: `${technician.nome} removido da oficina ${office.nome}.`,
          before: { tecnico_id: technician.id, oficina_id: office.id },
        });

        toast.success("Oficina removida", `${office.nome} foi removida deste técnico.`);
      } else {
        const { data, error: insertError } = await supabase
          .from("oficinas_martelinhos")
          .insert({
            conta_id: contaId,
            oficina_id: office.id,
            tecnico_id: technician.id,
            created_by: usuarioId || null,
          })
          .select("id,conta_id,oficina_id,tecnico_id,created_at")
          .single();

        if (insertError) throw insertError;

        setLinks((current) => [
          ...current,
          {
            ...data,
            oficina: {
              id: office.id,
              nome: office.nome,
              cidade: office.cidade,
              estado_regiao: office.estado_regiao,
              pais: office.pais,
              ativo: office.ativo,
            },
          },
        ]);

        await logAudit(supabase, me, {
          action: "vincular_oficina",
          recordId: technician.id,
          description: `${technician.nome} vinculado à oficina ${office.nome}.`,
          after: { tecnico_id: technician.id, oficina_id: office.id },
        });

        toast.success("Oficina vinculada", `${technician.nome} agora aparece em ${office.nome}.`);
      }
    } catch (relationError) {
      console.error("Vínculo técnico/oficina", relationError);
      toast.error("Não foi possível alterar o vínculo", relationError?.message || "Tente novamente.");
    } finally {
      setMutatingOfficeId("");
    }
  }

  function reportRows() {
    return filteredRows.map((row) => [
      formatDate(row.date),
      row.identifier || "—",
      [vehicleName(row.vehicle), row.vehicle?.ano, row.vehicle?.cor].filter(Boolean).join(" · "),
      row.office?.nome || "—",
      SERVICE_STATUS_META[row.status]?.label || row.status || "—",
      formatMoney(row.serviceValue),
      formatPercent(row.percent),
      row.cancelled ? "—" : formatMoney(row.technicianValue),
      row.cancelled
        ? "Sem repasse"
        : row.paid
          ? `Pago${row.movement?.data_pagamento ? ` em ${formatDate(row.movement.data_pagamento)}` : ""}`
          : row.movement
            ? "A repassar"
            : "Sem lançamento",
    ]);
  }

  const reportHeaders = [
    "Data",
    "Placa/Chassi",
    "Veículo",
    "Oficina",
    "Status",
    "Valor do serviço",
    "Comissão",
    "Valor do técnico",
    "Repasse",
  ];

  function exportExcel() {
    if (!technician) return;

    const payment = paymentDetails(technician);
    const serviceRows = filteredRows.map((row) => ({
      tone: row.cancelled ? "danger" : undefined,
      cells: [
        row.date,
        row.identifier || "—",
        [vehicleName(row.vehicle), row.vehicle?.ano, row.vehicle?.cor].filter(Boolean).join(" · "),
        row.office?.nome || "—",
        SERVICE_STATUS_META[row.status]?.label || row.status || "—",
        row.serviceValue,
        row.percent,
        row.cancelled ? 0 : row.technicianValue,
        row.cancelled
          ? "Sem repasse"
          : row.paid
            ? "Pago"
            : row.movement
              ? "A repassar"
              : "Sem lançamento",
        row.paid ? row.movement?.data_pagamento || "" : "",
      ],
    }));

    downloadExcelReport({
      filename: `fechamento_${normalizeText(technician.nome).replace(/\s+/g, "-")}_${dateFrom || "inicio"}_${dateTo || todayISO(timezone)}.xlsx`,
      title: `Fechamento · ${technician.nome}`,
      subtitle: me?.conta?.nome_fantasia || me?.conta?.nome || "PDR Hub",
      currency: config?.moeda || "EUR",
      dateFormat: config?.formato_data,
      metadata: [
        ["Período", periodLabel],
        ["Oficina", officeFilterLabel],
        ["Moeda", config?.moeda || "EUR"],
      ],
      sections: [
        {
          title: "Resumo do fechamento",
          sheetName: "Resumo",
          headers: ["Indicador", "Valor"],
          columns: [{ type: "text", width: 30 }, { type: "money", width: 24 }],
          rows: [
            ["Serviços", { value: totals.count, type: "integer" }],
            ["Valor dos serviços", totals.serviceValue],
            ["Comissão média", { value: totals.averagePercent, type: "percent" }],
            ["Total do técnico", totals.technicianValue],
            { tone: "success", cells: ["Já pago", totals.paid] },
            ...payment.map(([label, value]) => [`Pagamento · ${label}`, { value, type: "text" }]),
          ],
          totals: [{ tone: "result", cells: ["A repassar", totals.pending] }],
        },
        {
          title: `Serviços · ${periodLabel}`,
          sheetName: "Serviços",
          headers: [
            "Data",
            "Placa/Chassi",
            "Veículo",
            "Oficina",
            "Status",
            "Valor do serviço",
            "Comissão",
            "Valor do técnico",
            "Repasse",
            "Pago em",
          ],
          columns: [
            { type: "date" },
            { type: "text" },
            { type: "text", width: 34 },
            { type: "text" },
            { type: "text" },
            { type: "money" },
            { type: "percent" },
            { type: "money" },
            { type: "text" },
            { type: "date" },
          ],
          rows: serviceRows,
          totals: [
            {
              tone: "result",
              cells: [
                "",
                "",
                `${totals.count} serviço(s)`,
                "",
                "Total",
                totals.serviceValue,
                { value: totals.averagePercent, type: "percent" },
                totals.technicianValue,
                "",
                "",
              ],
            },
            ["", "", "", "", "Já pago", "", "", totals.paid, "", ""],
            { tone: "result", cells: ["", "", "", "", "A repassar", "", "", totals.pending, "", ""] },
          ],
        },
        {
          title: "Resumo por oficina",
          sheetName: "Por oficina",
          headers: ["Oficina", "Serviços", "Valor dos serviços", "Total do técnico", "A repassar"],
          columns: [{ type: "text" }, { type: "integer" }, { type: "money" }, { type: "money" }, { type: "money" }],
          rows: officeBreakdown.map((entry) => [
            entry.name,
            entry.count,
            entry.serviceValue,
            entry.technicianValue,
            entry.pending,
          ]),
        },
      ],
    }).catch((exportError) => {
      console.error("Exportar fechamento", exportError);
      toast.error("Não foi possível exportar", "Tente novamente.");
    });
  }

  function printReport() {
    if (!technician) return;

    const payment = paymentDetails(technician);
    const opened = openPrintReport({
      title: `Fechamento · ${technician.nome}`,
      subtitle: me?.conta?.nome_fantasia || me?.conta?.nome || "PDR Hub",
      locale,
      metadata: [
        ["Período", periodLabel],
        ["Oficina", officeFilterLabel],
        ["Serviços", totals.count],
        ["Moeda", config?.moeda || "EUR"],
        ...payment,
      ],
      summaryCards: [
        { label: "Valor dos serviços", value: formatMoney(totals.serviceValue) },
        {
          label: "Total do técnico",
          value: formatMoney(totals.technicianValue),
          caption: `Comissão média ${formatPercent(totals.averagePercent)}`,
        },
        { label: "Já pago", value: formatMoney(totals.paid), tone: "success" },
        {
          label: "A repassar",
          value: formatMoney(totals.pending),
          tone: totals.pending > 0 ? "warning" : "success",
        },
      ],
      sections: [
        {
          title: "Serviços do período",
          description: "Valor do serviço, percentual de comissão e valor devido ao técnico.",
          headers: reportHeaders,
          numericColumns: [5, 6, 7],
          rows: [
            ...reportRows(),
            {
              tone: "result",
              cells: [
                "Total",
                "",
                "",
                "",
                `${totals.count} serviço(s)`,
                formatMoney(totals.serviceValue),
                "",
                formatMoney(totals.technicianValue),
                `A repassar: ${formatMoney(totals.pending)}`,
              ],
            },
          ],
        },
        {
          title: "Resumo por oficina",
          headers: ["Oficina", "Serviços", "Valor dos serviços", "Total do técnico", "A repassar"],
          numericColumns: [1, 2, 3, 4],
          rows: officeBreakdown.map((entry) => [
            entry.name,
            entry.count,
            formatMoney(entry.serviceValue),
            formatMoney(entry.technicianValue),
            formatMoney(entry.pending),
          ]),
        },
      ],
    });

    if (!opened) {
      toast.warning("Pop-up bloqueado", "Permita pop-ups para gerar o PDF do fechamento.");
    }
  }

  if (loading) return <DetailSkeleton />;

  if (notFound || (!technician && error)) {
    return (
      <div className="space-y-5">
        <Link
          href="/panel/tecnicos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Técnicos
        </Link>
        <section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
            {notFound ? (
              <UserX className="size-6" strokeWidth={1.8} />
            ) : (
              <ShieldAlert className="size-6" strokeWidth={1.8} />
            )}
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {notFound ? "Técnico não encontrado" : "Falha ao carregar o técnico"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {notFound
              ? "O cadastro pode ter sido excluído ou não pertence a esta conta."
              : error}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" leftIcon={ArrowLeft} onClick={() => router.push("/panel/tecnicos")}>
              Voltar para técnicos
            </Button>
            {!notFound ? (
              <Button leftIcon={RefreshCw} onClick={() => loadData()}>
                Tentar novamente
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const photoUrl = getPhotoUrl(supabase, technician.foto_url);
  const phoneCode = resolvePhoneCountry(technician.telefone, technician.telefone_pais);
  const documentCode = resolveDocumentCountry(technician.documento, technician.documento_pais);
  const payment = paymentDetails(technician);

  return (
    <div className="space-y-5 pb-24 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Navegação">
        <Link
          href="/panel/tecnicos"
          className="inline-flex items-center gap-1.5 font-medium transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} />
          Técnicos
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={1.8} />
        <span className="truncate text-foreground">{technician.nome}</span>
      </nav>

      {/* Perfil */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="h-1.5 bg-primary" />
        <div className="flex flex-col gap-5 p-4 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar technician={technician} photoUrl={photoUrl} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {technician.nome}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge active={technician.ativo} />
                <CountryBadge code={technician.nacionalidade} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-4" strokeWidth={1.8} />
                  {technician.telefone
                    ? `${countryMeta(phoneCode).flag} ${formatPhone(technician.telefone, phoneCode)}`
                    : "Telefone não informado"}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{technician.email || "E-mail não informado"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:items-end">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">Serviços</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{lifetime.services}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">Total gerado</p>
                <p className="mt-0.5 truncate text-lg font-semibold text-foreground">
                  {formatMoney(lifetime.generated)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">A repassar</p>
                <p
                  className={`mt-0.5 truncate text-lg font-semibold ${
                    lifetime.pending > 0 ? "text-warning" : "text-foreground"
                  }`}
                >
                  {formatMoney(lifetime.pending)}
                </p>
              </div>
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
                leftIcon={Pencil}
                onClick={() => {
                  setFormKey((current) => current + 1);
                  setFormOpen(true);
                }}
              >
                Editar
              </Button>
              <Button variant="subtleDanger" leftIcon={Trash2} onClick={() => setDeleteTarget(technician)}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cadastro, pagamento e oficinas */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-foreground">
              <UserRound className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Dados do técnico</h2>
              <p className="text-xs text-muted-foreground">Identificação e cadastro</p>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <InfoItem icon={FileText} label={countryMeta(documentCode, "BR").documentLabel}>
              {technician.documento
                ? formatPersonDocument(technician.documento, documentCode)
                : "Não informado"}
            </InfoItem>
            <InfoItem icon={Globe2} label="Nacionalidade">
              {technician.nacionalidade
                ? `${countryMeta(technician.nacionalidade).flag} ${countryMeta(technician.nacionalidade).label}`
                : "Não informada"}
            </InfoItem>
            <InfoItem label="Cadastrado em" value={formatDateTimeByConfig(technician.created_at, config)} />
            <InfoItem label="Atualizado em" value={formatDateTimeByConfig(technician.updated_at, config)} />
          </div>

          <div className="mt-2.5 rounded-lg border border-border bg-background p-3.5">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
              {technician.observacoes || "Nenhuma observação cadastrada."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-foreground">
              <WalletCards className="size-4" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Dados para pagamento</h2>
              <p className="text-xs text-muted-foreground">Usados no repasse do fechamento</p>
            </div>
          </div>

          {payment.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {payment.map(([label, value]) => (
                <InfoItem
                  key={label}
                  icon={label === "Banco" ? Landmark : label === "Forma" ? WalletCards : undefined}
                  label={label}
                >
                  <span className="select-all">{value}</span>
                </InfoItem>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              Nenhum dado de pagamento cadastrado.
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={Pencil}
                  onClick={() => {
                    setFormKey((current) => current + 1);
                    setFormOpen(true);
                  }}
                >
                  Cadastrar
                </Button>
              </div>
            </div>
          )}

          {technician.dados_pagamento ? (
            <div className="mt-2.5 rounded-lg border border-border bg-background p-3.5">
              <p className="text-xs font-medium text-muted-foreground">Informações adicionais</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                {technician.dados_pagamento}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-foreground">
                <Building2 className="size-4" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Oficinas atuais</h2>
                <p className="text-xs text-muted-foreground">
                  {lifetime.offices} oficina(s) no histórico de serviços
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={Settings2}
              onClick={() => {
                setOfficeSearch("");
                setOfficesOpen(true);
              }}
            >
              Gerenciar
            </Button>
          </div>

          {links.length ? (
            <ul className="space-y-2">
              {[...links]
                .sort((a, b) =>
                  String(a.oficina?.nome || "").localeCompare(String(b.oficina?.nome || ""), "it", {
                    sensitivity: "base",
                  })
                )
                .map((link) => (
                  <li
                    key={link.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                      <Building2 className="size-4" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {link.oficina?.nome || "Oficina"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[link.oficina?.cidade, link.oficina?.pais].filter(Boolean).join(", ") ||
                          "Localização não informada"}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              Nenhuma oficina vinculada no momento.
            </div>
          )}
        </div>
      </section>

      {/* Fechamento */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Serviços e carros realizados, comissão e valor a repassar no período.
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Fechamento de repasses
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={Download} onClick={exportExcel} disabled={!filteredRows.length}>
              Excel
            </Button>
            <Button variant="secondary" leftIcon={Printer} onClick={printReport} disabled={!filteredRows.length}>
              PDF
            </Button>
            <Button
              leftIcon={CheckCircle2}
              onClick={() => openPayment(totals.payableRows)}
              disabled={!totals.payableRows.length}
            >
              Pagar período ({totals.payableRows.length})
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                <Filter className="size-4" strokeWidth={1.8} />
              </span>
              Filtros
            </div>

            <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.8}
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Placa/chassi, modelo, oficina..."
                  className="pl-9"
                />
              </div>

              <SearchableSelect
                value={officeFilter === "all" ? "" : officeFilter}
                onChange={(value) => setOfficeFilter(value || "all")}
                options={officeOptions}
                placeholder="Todas as oficinas"
                searchPlaceholder="Buscar oficina..."
              />

              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="valid">Todos (exceto cancelados)</option>
                <option value="concluido">Somente concluídos</option>
                <option value="em_andamento">Somente em andamento</option>
                <option value="agendado">Somente agendados</option>
                <option value="cancelado">Somente cancelados</option>
                <option value="all">Todos os status</option>
              </Select>

              <Select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                <option value="all">Repasse: todos</option>
                <option value="pending">Repasse: a pagar</option>
                <option value="paid">Repasse: pagos</option>
              </Select>
            </div>

            {hasActiveFilters ? (
              <Button variant="ghost" leftIcon={X} onClick={resetFilters}>
                Limpar
              </Button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_minmax(0,12rem)_1fr] xl:items-center">
            <Select value={periodPreset} onChange={(event) => changePeriodPreset(event.target.value)}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <DateInput
              value={dateFrom}
              max={dateTo || undefined}
              aria-label="Data inicial"
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPeriodPreset("custom");
              }}
            />
            <DateInput
              value={dateTo}
              min={dateFrom || undefined}
              aria-label="Data final"
              onChange={(event) => {
                setDateTo(event.target.value);
                setPeriodPreset("custom");
              }}
            />
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground xl:justify-end">
              <CalendarRange className="size-3.5" strokeWidth={1.8} />
              {periodLabel} · pela data do serviço
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Valor dos serviços"
            value={formatMoney(totals.serviceValue)}
            caption="Valor bruto dos carros"
            icon={Car}
          />
          <MetricCard
            label="Total do técnico"
            value={formatMoney(totals.technicianValue)}
            caption={`Comissão média ${formatPercent(totals.averagePercent)}`}
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Já pago"
            value={formatMoney(totals.paid)}
            caption="Repasses liquidados"
            icon={BadgeCheck}
            tone="success"
          />
          <MetricCard
            label="A repassar"
            value={formatMoney(totals.pending)}
            caption="Saldo devido ao técnico"
            icon={Banknote}
            tone={totals.pending > 0 ? "warning" : "success"}
            emphasis={totals.pending > 0}
          />
        </div>

        {error ? (
          <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
            <p className="text-sm font-medium text-danger">{error}</p>
          </section>
        ) : null}

        {filteredRows.length ? (
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-surface-2 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border-strong accent-primary"
                        checked={allPayableSelected}
                        disabled={!totals.payableRows.length}
                        onChange={toggleAllPayable}
                        aria-label="Selecionar todos os repasses pendentes do filtro"
                        title="Selecionar todos os repasses pendentes do filtro"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                        }
                        className="inline-flex items-center gap-1 font-medium transition hover:text-foreground"
                      >
                        Data
                        {sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5" strokeWidth={2} />
                        ) : (
                          <ArrowDown className="size-3.5" strokeWidth={2} />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Placa/Chassi</th>
                    <th className="px-4 py-3 font-medium">Veículo</th>
                    <th className="px-4 py-3 font-medium">Oficina</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor do serviço</th>
                    <th className="px-4 py-3 text-right font-medium">Comissão</th>
                    <th className="px-4 py-3 text-right font-medium">Valor do técnico</th>
                    <th className="px-4 py-3 font-medium">Repasse</th>
                    <th className="w-12 px-4 py-3" aria-label="Ações" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {pagedRows.map((row) => {
                    const selected = row.payable && selectedIds.has(row.id);

                    return (
                      <tr
                        key={row.id}
                        onClick={() => toggleRow(row)}
                        className={`align-middle transition ${
                          row.payable ? "cursor-pointer" : ""
                        } ${
                          selected
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-surface-2/60"
                        } ${row.cancelled ? "opacity-60" : ""}`}
                      >
                        <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border-strong accent-primary disabled:opacity-30"
                            checked={selected}
                            disabled={!row.payable}
                            onChange={() => toggleRow(row)}
                            aria-label={`Selecionar serviço ${row.identifier || ""}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-medium text-foreground">
                          {formatDate(row.date)}
                        </td>
                        <td className="px-4 py-3.5">
                          {row.identifier ? (
                            <span className="inline-flex flex-col">
                              <span className="inline-flex w-fit items-center rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
                                {row.identifier}
                              </span>
                              {row.vehicle?.placa && row.vehicle?.chassi ? (
                                <span className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">
                                  {row.vehicle.chassi}
                                </span>
                              ) : !row.vehicle?.placa ? (
                                <span className="mt-1 text-[11px] text-muted-foreground">Chassi</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não informado</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="max-w-56 truncate font-medium text-foreground">
                            {vehicleName(row.vehicle)}
                          </p>
                          <p className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground">
                            {[row.vehicle?.ano, row.vehicle?.cor].filter(Boolean).join(" · ") ||
                              row.description ||
                              "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="block max-w-48 truncate text-foreground">
                            {row.office?.nome || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <ServiceStatusBadge status={row.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right text-foreground">
                          {formatMoney(row.serviceValue)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right">
                          <span className="font-medium text-foreground">{formatPercent(row.percent)}</span>
                          {row.sharedWith ? (
                            <span
                              className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"
                              title="Serviço dividido com outros técnicos"
                            >
                              <Users className="size-3" strokeWidth={1.8} />+{row.sharedWith} técnico(s)
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-foreground">
                          {row.cancelled ? "—" : formatMoney(row.technicianValue)}
                        </td>
                        <td className="px-4 py-3.5">
                          <RepasseBadge row={row} formatDate={formatDate} />
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                          {row.paid ? (
                            <Button
                              variant="ghost"
                              size="iconSm"
                              title="Desfazer pagamento"
                              aria-label="Desfazer pagamento"
                              onClick={() => setReopenTarget(row)}
                            >
                              <RotateCcw className="size-4" strokeWidth={1.8} />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="border-t-2 border-border bg-surface-2/70">
                  <tr>
                    <td className="px-4 py-3.5" />
                    <td colSpan={5} className="px-4 py-3.5">
                      <span className="text-sm font-semibold text-foreground">Total do filtro</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {totals.count} serviço(s){" "}
                        {filteredRows.length > totals.count
                          ? `· ${filteredRows.length - totals.count} cancelado(s) fora da soma`
                          : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-foreground">
                      {formatMoney(totals.serviceValue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs text-muted-foreground">
                      média {formatPercent(totals.averagePercent)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-base font-semibold text-foreground">
                      {formatMoney(totals.technicianValue)}
                    </td>
                    <td colSpan={2} className="whitespace-nowrap px-4 py-3.5">
                      <span className="text-xs text-muted-foreground">A repassar </span>
                      <span
                        className={`font-semibold ${
                          totals.pending > 0 ? "text-warning" : "text-success"
                        }`}
                      >
                        {formatMoney(totals.pending)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filteredRows.length > PAGE_SIZES[0] ? (
              <div className="flex flex-col gap-3 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>
                    Mostrando{" "}
                    <strong className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</strong>{" "}
                    a{" "}
                    <strong className="font-semibold text-foreground">
                      {Math.min(page * pageSize, filteredRows.length)}
                    </strong>{" "}
                    de <strong className="font-semibold text-foreground">{filteredRows.length}</strong>
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
                      <span key={item} className="grid size-10 place-items-center text-sm text-muted-foreground">
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
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-foreground">
              <ReceiptText className="size-6" strokeWidth={1.8} />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {rows.length ? "Nenhum serviço neste filtro" : "Nenhum serviço realizado ainda"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {rows.length
                ? "Ajuste o período, a oficina ou os demais filtros para encontrar os serviços do fechamento."
                : "Quando este técnico for incluído em um serviço, ele aparecerá aqui com o valor da comissão."}
            </p>
            {rows.length > 0 && hasActiveFilters ? (
              <div className="mt-5">
                <Button variant="secondary" leftIcon={CalendarRange} onClick={() => changePeriodPreset("all")}>
                  Ver todo o histórico
                </Button>
              </div>
            ) : null}
          </section>
        )}

        {officeBreakdown.length > 1 ? (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Resumo por oficina</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {officeBreakdown.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => entry.id !== "sem-oficina" && setOfficeFilter(entry.id)}
                  className="rounded-xl border border-border bg-surface p-3.5 text-left transition hover:border-border-strong hover:bg-surface-2/60"
                  title="Filtrar por esta oficina"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {entry.count} serv.
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground">Técnico</span>
                      <strong className="text-sm font-semibold text-foreground">
                        {formatMoney(entry.technicianValue)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="block text-muted-foreground">A repassar</span>
                      <strong
                        className={`text-sm font-semibold ${
                          entry.pending > 0 ? "text-warning" : "text-success"
                        }`}
                      >
                        {formatMoney(entry.pending)}
                      </strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Barra de seleção */}
      {selectedRows.length ? (
        <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl rounded-xl border border-border bg-surface p-3 shadow-2xl md:bottom-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Banknote className="size-5" strokeWidth={1.8} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selectedRows.length} repasse(s) selecionado(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Total a pagar:{" "}
                  <strong className="font-semibold text-foreground">{formatMoney(selectedValue)}</strong>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" leftIcon={X} onClick={() => setSelectedIds(new Set())}>
                Limpar
              </Button>
              <Button leftIcon={CheckCircle2} onClick={() => openPayment(selectedRows)}>
                Registrar pagamento
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Pagamento do fechamento */}
      <Modal
        open={paymentOpen}
        onClose={() => {
          if (!paying) setPaymentOpen(false);
        }}
        title="Registrar pagamento do fechamento"
        description={`${technician.nome} · ${periodLabel}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button type="submit" form="closing-payment-form" loading={paying} leftIcon={CheckCircle2}>
              Confirmar pagamento
            </Button>
          </>
        }
      >
        <Form id="closing-payment-form" onSubmit={confirmPayment}>
          <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Valor a repassar</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                  {formatMoney(paymentRows.reduce((sum, row) => sum + row.technicianValue, 0))}
                </p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <p>
                  <strong className="font-semibold text-foreground">{paymentRows.length}</strong> serviço(s)
                </p>
                <p>
                  Serviços:{" "}
                  {formatMoney(paymentRows.reduce((sum, row) => sum + row.serviceValue, 0))}
                </p>
              </div>
            </div>
          </div>

          {payment.length ? (
            <div className="grid gap-2 rounded-xl border border-border bg-background p-3.5 sm:grid-cols-2">
              {payment.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                  <p className="select-all break-words text-sm font-medium text-foreground">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              Este técnico não possui dados de pagamento cadastrados.
            </p>
          )}

          <FormSection>
            <FormGrid>
              <FormField label="Data do pagamento" required>
                <DateInput
                  value={paymentForm.data_pagamento}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, data_pagamento: event.target.value }))
                  }
                />
              </FormField>
              <FormField label="Forma de pagamento">
                <Input
                  value={paymentForm.forma_pagamento}
                  onChange={(event) =>
                    setPaymentForm((current) => ({ ...current, forma_pagamento: event.target.value }))
                  }
                  placeholder="Ex.: PIX, transferência, dinheiro..."
                />
              </FormField>
            </FormGrid>
            <FormField label="Observação nos lançamentos">
              <Textarea
                value={paymentForm.observacoes}
                onChange={(event) =>
                  setPaymentForm((current) => ({ ...current, observacoes: event.target.value }))
                }
                rows={2}
                placeholder="Referência do fechamento, comprovante..."
              />
            </FormField>
          </FormSection>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Placa/Chassi</th>
                  <th className="px-3 py-2 font-medium">Oficina</th>
                  <th className="px-3 py-2 text-right font-medium">Técnico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentRows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDate(row.date)}</td>
                    <td className="px-3 py-2 font-mono uppercase">{row.identifier || "—"}</td>
                    <td className="max-w-40 truncate px-3 py-2">{row.office?.nome || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-foreground">
                      {formatMoney(row.technicianValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Form>
      </Modal>

      {/* Desfazer pagamento */}
      <Modal
        open={Boolean(reopenTarget)}
        onClose={() => {
          if (!reopening) setReopenTarget(null);
        }}
        title="Desfazer pagamento"
        description="O repasse volta para pendente e entra novamente no próximo fechamento."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReopenTarget(null)} disabled={reopening}>
              Cancelar
            </Button>
            <Button variant="danger" loading={reopening} leftIcon={RotateCcw} onClick={confirmReopen}>
              Desfazer
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Desfazer o pagamento de{" "}
          <strong className="font-semibold text-foreground">
            {reopenTarget ? formatMoney(reopenTarget.technicianValue) : ""}
          </strong>{" "}
          referente ao veículo{" "}
          <strong className="font-semibold text-foreground">{reopenTarget?.identifier || "sem identificação"}</strong>{" "}
          de {reopenTarget ? formatDate(reopenTarget.date) : ""}?
        </p>
      </Modal>

      {/* Oficinas */}
      <Modal
        open={officesOpen}
        onClose={() => setOfficesOpen(false)}
        title="Oficinas do técnico"
        description="Clique para vincular ou remover. As selecionadas aparecem primeiro."
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setOfficesOpen(false)}>
            Concluir
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.8}
            />
            <Input
              value={officeSearch}
              onChange={(event) => setOfficeSearch(event.target.value)}
              placeholder="Buscar oficina..."
              className="pl-9"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {pickerOffices.map((office) => {
              const linked = linkedOfficeIds.has(office.id);
              const busy = mutatingOfficeId === office.id;

              return (
                <button
                  key={office.id}
                  type="button"
                  aria-pressed={linked}
                  disabled={Boolean(mutatingOfficeId)}
                  onClick={() => toggleOffice(office)}
                  className={`group flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-70 ${
                    linked
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-background hover:border-border-strong hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                      linked ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    {busy ? (
                      <RefreshCw className="size-4 animate-spin" strokeWidth={1.8} />
                    ) : linked ? (
                      <Check className="size-4" strokeWidth={2.2} />
                    ) : (
                      <Building2 className="size-4" strokeWidth={1.8} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{office.nome}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[office.cidade, office.pais].filter(Boolean).join(", ") || "Localização não informada"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {!pickerOffices.length ? (
            <div className="rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
              Nenhuma oficina encontrada para esta busca.
            </div>
          ) : null}
        </div>
      </Modal>

      <TechnicianFormModal
        key={formKey}
        open={formOpen}
        technician={technician}
        me={me}
        supabase={supabase}
        onClose={() => setFormOpen(false)}
        onSaved={(data) => {
          setTechnician(data);
          setFormOpen(false);
        }}
      />

      <TechnicianDeleteModal
        target={deleteTarget}
        me={me}
        supabase={supabase}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          router.replace("/panel/tecnicos");
        }}
      />
    </div>
  );
}
