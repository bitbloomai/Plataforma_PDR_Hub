"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Filter,
  Gauge,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
  XCircle,
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
  MultiSelect,
  SearchableSelect,
  Select,
  Textarea,
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayMoney, moneyFromStorage, withSourceCurrency } from "@/lib/currency";
import { localISO, todayISO } from "@/lib/dates";
import { toast } from "@/lib/toast";
import { formatDateByConfig } from "@/lib/formatters";
import {
  buildServiceFinancialRows,
  buildServiceTechnicianRows,
} from "@/lib/service-rules";

const PAGE_SIZES = [10, 20, 50];
const SERVICE_STATUSES = ["agendado", "em_andamento", "concluido", "cancelado"];

const STATUS_META = {
  agendado: {
    label: "Agendado",
    shortLabel: "Agendados",
    icon: CalendarDays,
    tone: "warning",
    dotClass: "bg-warning",
    badgeClass: "bg-warning/10 text-warning",
  },
  em_andamento: {
    label: "Em andamento",
    shortLabel: "Em andamento",
    icon: Clock3,
    tone: "primary",
    dotClass: "bg-primary",
    badgeClass: "bg-primary/12 text-foreground",
  },
  concluido: {
    label: "Concluído",
    shortLabel: "Concluídos",
    icon: CheckCircle2,
    tone: "success",
    dotClass: "bg-success",
    badgeClass: "bg-success/10 text-success",
  },
  cancelado: {
    label: "Cancelado",
    shortLabel: "Cancelados",
    icon: XCircle,
    tone: "danger",
    dotClass: "bg-danger",
    badgeClass: "bg-danger/10 text-danger",
  },
};

function getPresetRange(preset, timezone) {
  const today = new Date(`${todayISO(timezone)}T12:00:00`);

  if (preset === "today") {
    const value = localISO(today);
    return { from: value, to: value };
  }

  if (preset === "week") {
    const offset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - offset);
    return { from: localISO(monday), to: localISO(today) };
  }

  if (preset === "previous_month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localISO(first), to: localISO(last) };
  }

  if (preset === "year") {
    return { from: `${today.getFullYear()}-01-01`, to: localISO(today) };
  }

  return {
    from: localISO(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function createEmptyForm() {
  return {
    status: "agendado",
    data_servico: todayISO(),
    oficina_id: "",
    vehicleMode: "existing",
    veiculo_id: "",
    valor: 0,
    technician_ids: [],
    percentages: {},
    descricao: "",
    observacoes: "",
    newVehicle: {
      placa: "",
      marca: "",
      modelo: "",
      ano: "",
      cor: "",
    },
  };
}

function createServiceForm(timezone) {
  return {
    ...createEmptyForm(),
    data_servico: todayISO(timezone),
  };
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
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

function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function isSettledStatus(status) {
  return ["pago", "recebido", "paid"].includes(String(status || "").toLowerCase());
}

function isRevenue(movement) {
  return String(movement?.tipo || "").toLowerCase() === "receita";
}

function isExpense(movement) {
  return String(movement?.tipo || "").toLowerCase() === "despesa";
}

function autoMovements(service) {
  return (service?.movimentacoes_financeiras || []).filter((movement) =>
    ["servico", "repasse_tecnico"].includes(String(movement?.origem || "").toLowerCase())
  );
}

function hasSettledFinancial(service) {
  return autoMovements(service).some((movement) => isSettledStatus(movement.status));
}

function revenueMovement(service) {
  return autoMovements(service).find(
    (movement) => isRevenue(movement) && String(movement.origem).toLowerCase() === "servico"
  );
}

function technicianMovement(service, technicianId) {
  return autoMovements(service).find(
    (movement) =>
      isExpense(movement) &&
      String(movement.origem).toLowerCase() === "repasse_tecnico" &&
      movement.tecnico_id === technicianId
  );
}

function financialLabel(movement) {
  if (!movement) return "Não gerado";
  if (isSettledStatus(movement.status)) return isRevenue(movement) ? "Recebido" : "Pago";
  return "Pendente";
}

function financialBadgeClass(movement) {
  if (!movement) return "bg-surface-2 text-muted-foreground";
  return isSettledStatus(movement.status)
    ? "bg-success/10 text-success"
    : "bg-warning/10 text-warning";
}

function vehicleName(vehicle) {
  return [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "Veículo sem descrição";
}

function serviceTechnicians(service) {
  return (service?.servicos_tecnicos || []).filter(Boolean);
}

function serviceRepasseTotal(service, convertMoney) {
  return serviceTechnicians(service).reduce((total, link) => {
    const sourceCurrency = link.moeda || service?.moeda;
    const value =
      typeof convertMoney === "function"
        ? convertMoney(link.valor_repasse, sourceCurrency)
        : safeNumber(link.valor_repasse);

    return total + value;
  }, 0);
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
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

function getPhotoUrl(supabase, pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const cleanPath = String(pathOrUrl)
    .replace(/^\/+/, "")
    .replace(/^perfis\//, "");

  const { data } = supabase.storage.from("perfis").getPublicUrl(cleanPath);
  return data?.publicUrl || null;
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

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.agendado;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

function FinanceBadge({ movement }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${financialBadgeClass(
        movement
      )}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          movement && isSettledStatus(movement.status) ? "bg-success" : "bg-warning"
        }`}
      />
      {financialLabel(movement)}
    </span>
  );
}

function TechnicianAvatar({ technician, photoUrl }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 text-[10px] font-semibold text-foreground">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={technician?.nome || "Tecnico"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(technician?.nome)
      )}
    </span>
  );
}

function ServiceCard({
  service,
  formatMoney,
  moneyValue,
  formatServiceDate,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  statusBusy,
}) {
  const revenue = revenueMovement(service);
  const techs = serviceTechnicians(service);
  const serviceValue = moneyValue(service.valor, service.moeda);
  const repasse = serviceRepasseTotal(service, moneyValue);
  const margin = serviceValue - repasse;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(service)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(service);
        }
      }}
      className="group rounded-xl border border-border bg-surface transition duration-200 hover:border-border-strong hover:bg-surface-2/35 focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(220px,1.35fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(150px,.8fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={service.status} />
            <span className="text-xs text-muted-foreground">
              {formatServiceDate(service.data_servico)}
            </span>
          </div>

          <div className="mt-3 flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-foreground">
              <Car className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">
                {vehicleName(service.veiculo)}
              </h3>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {service.veiculo?.placa || "Sem placa"}
                {service.veiculo?.ano ? ` · ${service.veiculo.ano}` : ""}
                {service.veiculo?.cor ? ` · ${service.veiculo.cor}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Oficina
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
            <span className="truncate text-sm font-medium text-foreground">
              {service.oficina?.nome || "Oficina não encontrada"}
            </span>
          </div>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Técnicos
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            {techs.length ? (
              <>
                <div className="flex items-center">
                  {techs.slice(0, 3).map((link, index) => (
                    <span key={link.id || link.tecnico_id} className={index ? "-ml-2" : ""}>
                      <TechnicianAvatar technician={link.tecnico} />
                    </span>
                  ))}
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {techs
                    .slice(0, 2)
                    .map((link) => link.tecnico?.nome)
                    .filter(Boolean)
                    .join(", ")}
                  {techs.length > 2 ? ` +${techs.length - 2}` : ""}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Sem técnico</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recebimento
            </p>
            <div className="mt-2">
              {service.status === "cancelado" ? (
                <span className="text-xs font-medium text-muted-foreground">Cancelado</span>
              ) : (
                <FinanceBadge movement={revenue} />
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resultado bruto
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatMoney(service.status === "cancelado" ? 0 : margin)}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:items-end">
          <div className="lg:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Valor do serviço
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {formatMoney(service.valor, service.moeda)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Repasses: {formatMoney(repasse)}
            </p>
          </div>

          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Select
              value={service.status}
              disabled={statusBusy}
              onChange={(event) => onStatusChange(service, event.target.value)}
              className="min-w-40"
              aria-label={`Alterar status do serviço ${service.veiculo?.placa || ""}`}
            >
              {SERVICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="icon"
              title="Editar serviço"
              aria-label="Editar serviço"
              onClick={() => onEdit(service)}
            >
              <Pencil className="size-4" strokeWidth={1.8} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Excluir serviço"
              aria-label="Excluir serviço"
              onClick={() => onDelete(service)}
            >
              <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ServiceTable({
  services,
  photoMap,
  formatMoney,
  moneyValue,
  formatServiceDate,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  statusBusyId,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Serviço</th>
              <th className="px-5 py-3 font-medium">Oficina</th>
              <th className="px-5 py-3 font-medium">Técnicos</th>
              <th className="px-5 py-3 font-medium">Financeiro</th>
              <th className="px-5 py-3 text-right font-medium">Valores</th>
              <th className="px-5 py-3 text-right font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {services.map((service) => {
              const revenue = revenueMovement(service);
              const techs = serviceTechnicians(service);
              const serviceValue = moneyValue(service.valor, service.moeda);
              const repasse = serviceRepasseTotal(service, moneyValue);
              const margin = serviceValue - repasse;
              const statusBusy = statusBusyId === service.id;

              return (
                <tr
                  key={service.id}
                  tabIndex={0}
                  onClick={() => onOpen(service)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(service);
                    }
                  }}
                  className="cursor-pointer align-middle transition hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none"
                >
                  <td className="px-5 py-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-foreground">
                        <Car className="size-5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {vehicleName(service.veiculo)}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {service.veiculo?.placa || "Sem placa"}
                          {service.veiculo?.ano ? ` - ${service.veiculo.ano}` : ""}
                          {service.veiculo?.cor ? ` - ${service.veiculo.cor}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatServiceDate(service.data_servico)}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                      <span className="truncate font-medium text-foreground">
                        {service.oficina?.nome || "Oficina não encontrada"}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    <div className="flex min-w-0 items-center gap-2">
                      {techs.length ? (
                        <>
                          <div className="flex items-center">
                            {techs.slice(0, 3).map((link, index) => (
                              <span key={link.id || link.tecnico_id} className={index ? "-ml-2" : ""}>
                                <TechnicianAvatar
                                  technician={link.tecnico}
                                  photoUrl={photoMap.get(link.tecnico_id)}
                                />
                              </span>
                            ))}
                          </div>
                          <span className="max-w-48 truncate text-sm text-muted-foreground">
                            {techs
                              .slice(0, 2)
                              .map((link) => link.tecnico?.nome)
                              .filter(Boolean)
                              .join(", ")}
                            {techs.length > 2 ? ` +${techs.length - 2}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem técnico</span>
                      )}
                    </div>
                  </td>

                  <td className="px-5 py-5">
                    {service.status === "cancelado" ? (
                      <span className="text-xs font-medium text-muted-foreground">Cancelado</span>
                    ) : (
                      <FinanceBadge movement={revenue} />
                    )}
                  </td>

                  <td className="px-5 py-5 text-right">
                    <p className="whitespace-nowrap font-semibold text-foreground">
                      {formatMoney(service.valor, service.moeda)}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                      Repasses: {formatMoney(repasse)}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-xs font-medium text-foreground">
                      Resultado: {formatMoney(service.status === "cancelado" ? 0 : margin)}
                    </p>
                  </td>

                  <td
                    className="px-5 py-5 text-right"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <div className="flex justify-end">
                      <Select
                        value={service.status}
                        disabled={statusBusy}
                        onChange={(event) => onStatusChange(service, event.target.value)}
                        className="min-w-40"
                        aria-label={`Alterar status do serviço ${service.veiculo?.placa || ""}`}
                      >
                        {SERVICE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_META[status].label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>

                  <td
                    className="px-5 py-5"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar serviço"
                        aria-label="Editar serviço"
                        onClick={() => onEdit(service)}
                      >
                        <Pencil className="size-4" strokeWidth={1.8} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir serviço"
                        aria-label="Excluir serviço"
                        onClick={() => onDelete(service)}
                      >
                        <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-2 px-5 py-3">
        <div className="grid animate-pulse grid-cols-7 gap-5">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-3 rounded bg-surface-3" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, row) => (
          <div key={row} className="grid animate-pulse grid-cols-7 gap-5 px-5 py-5">
            {Array.from({ length: 7 }).map((__, column) => (
              <div key={column} className="space-y-2">
                <div className="h-4 rounded bg-surface-2" />
                {column < 3 ? <div className="h-3 w-2/3 rounded bg-surface-2" /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServicosPage() {
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);
  const quickCreateHandledRef = useRef(false);

  const initialRange = useMemo(() => getPresetRange("month"), []);

  const [me, setMe] = useState(null);
  const [services, setServices] = useState([]);
  const [offices, setOffices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [officeTechnicians, setOfficeTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [periodPreset, setPeriodPreset] = useState("month");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]);
  const [page, setPage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState(createEmptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState("");

  const contaId = me?.usuario?.conta_id || "";
  const usuarioId = me?.usuario?.id || "";
  const currency = me?.configuracao?.moeda || "EUR";
  const locale = me?.configuracao?.locale || "it-IT";

  const formatMoney = useCallback(
    (value, sourceCurrency) =>
      formatDisplayMoney(value, withSourceCurrency(me?.configuracao, sourceCurrency || me?.configuracao?.moeda)),
    [me?.configuracao]
  );

  const moneyValue = useCallback(
    (value, sourceCurrency) => moneyFromStorage(value, withSourceCurrency(me?.configuracao, sourceCurrency), sourceCurrency),
    [me?.configuracao]
  );

  const formatServiceDate = useCallback(
    (value) => {
      if (!value) return "Data não informada";
      return formatDateByConfig(value, me?.configuracao) || value;
    },
    [me?.configuracao]
  );

  const formatDateTime = useCallback(
    (value) => {
      if (!value) return "Não informado";
      try {
        return new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: me?.configuracao?.timezone || "Europe/Rome",
        }).format(new Date(value));
      } catch {
        return String(value);
      }
    },
    [locale, me?.configuracao?.timezone]
  );

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const meData = meRef.current || (await fetchMe());
        meRef.current = meData;
        const currentContaId = meData?.usuario?.conta_id;

        if (!currentContaId) throw new Error("Usuário sem conta vinculada.");

        const [servicesResult, officesResult, techniciansResult, vehiclesResult, linksResult] =
          await Promise.all([
            supabase
              .from("servicos")
              .select(
                `
                  id,
                  conta_id,
                  oficina_id,
                  veiculo_id,
                  data_servico,
                  valor,
                  moeda,
                  status,
                  descricao,
                  observacoes,
                  created_by,
                  updated_by,
                  created_at,
                  updated_at,
                  oficina:oficinas(id,nome,responsavel,cidade,estado_regiao,ativo),
                  veiculo:veiculos(id,placa,marca,modelo,ano,cor,chassi),
                  servicos_tecnicos(
                    id,
                    tecnico_id,
                    percentual,
                    valor_repasse,
                    moeda,
                    created_by,
                    created_at,
                    tecnico:tecnicos(id,nome,email,telefone,foto_url,ativo)
                  ),
                  movimentacoes_financeiras(
                    id,
                    categoria_id,
                    servico_id,
                    tecnico_id,
                    oficina_id,
                    tipo,
                    origem,
                    descricao,
                    valor,
                    moeda,
                    status,
                    data_competencia,
                    data_vencimento,
                    data_pagamento,
                    forma_pagamento,
                    observacoes,
                    created_by,
                    updated_by,
                    created_at,
                    updated_at
                  )
                `
              )
              .eq("conta_id", currentContaId)
              .order("data_servico", { ascending: false })
              .order("created_at", { ascending: false })
              .range(0, 4999),
            supabase
              .from("oficinas")
              .select("id,conta_id,nome,cidade,estado_regiao,ativo")
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("nome", { ascending: true })
              .range(0, 4999),
            supabase
              .from("tecnicos")
              .select("id,conta_id,nome,email,telefone,foto_url,ativo")
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("nome", { ascending: true })
              .range(0, 4999),
            supabase
              .from("veiculos")
              .select("id,conta_id,placa,marca,modelo,ano,cor,chassi,observacoes")
              .eq("conta_id", currentContaId)
              .order("placa", { ascending: true })
              .range(0, 4999),
            supabase
              .from("oficinas_martelinhos")
              .select("id,conta_id,oficina_id,tecnico_id")
              .eq("conta_id", currentContaId)
              .range(0, 4999),
          ]);

        if (servicesResult.error) throw servicesResult.error;
        if (officesResult.error) throw officesResult.error;
        if (techniciansResult.error) throw techniciansResult.error;
        if (vehiclesResult.error) throw vehiclesResult.error;
        if (linksResult.error) throw linksResult.error;

        setMe(meData);
        setServices(servicesResult.data || []);
        setOffices(officesResult.data || []);
        setTechnicians(techniciansResult.data || []);
        setVehicles(vehiclesResult.data || []);
        setOfficeTechnicians(linksResult.data || []);
      } catch (loadError) {
        console.error("Serviços load", loadError);
        const message = loadError?.message || "Não foi possível carregar os serviços.";
        setError(message);
        toast.error("Não foi possível carregar", message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const frameId = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(frameId);
  }, [loadData]);

  useEffect(() => {
    if (quickCreateHandledRef.current || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") !== "1") return;

    quickCreateHandledRef.current = true;
    openCreate();

    params.delete("novo");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`
    );
  }, []);

  const officeOptions = useMemo(
    () =>
      offices
        .filter((office) => office.ativo || office.id === editingService?.oficina_id)
        .map((office) => ({
          value: office.id,
          label: [office.nome, office.cidade].filter(Boolean).join(" · "),
        })),
    [editingService?.oficina_id, offices]
  );

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.placa} · ${vehicleName(vehicle)}${vehicle.ano ? ` · ${vehicle.ano}` : ""}`,
      })),
    [vehicles]
  );

  const linkedTechnicianIds = useMemo(() => {
    if (!form.oficina_id) return new Set();
    return new Set(
      officeTechnicians
        .filter((link) => link.oficina_id === form.oficina_id)
        .map((link) => link.tecnico_id)
    );
  }, [form.oficina_id, officeTechnicians]);

  const technicianOptions = useMemo(() => {
    return technicians
      .filter((technician) => technician.ativo || form.technician_ids.includes(technician.id))
      .sort((a, b) => {
        const aLinked = linkedTechnicianIds.has(a.id) ? 1 : 0;
        const bLinked = linkedTechnicianIds.has(b.id) ? 1 : 0;
        if (aLinked !== bLinked) return bLinked - aLinked;
        return a.nome.localeCompare(b.nome, locale, { sensitivity: "base" });
      })
      .map((technician) => ({
        value: technician.id,
        label: linkedTechnicianIds.has(technician.id)
          ? `${technician.nome} · vinculado à oficina`
          : technician.nome,
      }));
  }, [form.technician_ids, linkedTechnicianIds, locale, technicians]);

  const techniciansById = useMemo(
    () => new Map(technicians.map((technician) => [technician.id, technician])),
    [technicians]
  );

  const photoMap = useMemo(() => {
    const map = new Map();
    technicians.forEach((technician) => {
      map.set(technician.id, getPhotoUrl(supabase, technician.foto_url));
    });
    return map;
  }, [supabase, technicians]);

  const statusBaseServices = useMemo(() => {
    const term = normalizeText(search);

    return services.filter((service) => {
      if (dateFrom && service.data_servico < dateFrom) return false;
      if (dateTo && service.data_servico > dateTo) return false;
      if (officeFilter !== "all" && service.oficina_id !== officeFilter) return false;
      if (
        technicianFilter !== "all" &&
        !serviceTechnicians(service).some((link) => link.tecnico_id === technicianFilter)
      ) {
        return false;
      }

      if (!term) return true;

      const techNames = serviceTechnicians(service)
        .map((link) => link.tecnico?.nome)
        .filter(Boolean)
        .join(" ");

      const haystack = normalizeText(
        [
          service.oficina?.nome,
          service.veiculo?.placa,
          service.veiculo?.marca,
          service.veiculo?.modelo,
          service.veiculo?.ano,
          service.veiculo?.cor,
          service.descricao,
          service.observacoes,
          techNames,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(term);
    });
  }, [dateFrom, dateTo, officeFilter, search, services, technicianFilter]);

  const filteredServices = useMemo(() => {
    if (statusFilter === "all") return statusBaseServices;
    return statusBaseServices.filter((service) => service.status === statusFilter);
  }, [statusBaseServices, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: statusBaseServices.length,
      agendado: 0,
      em_andamento: 0,
      concluido: 0,
      cancelado: 0,
    };

    statusBaseServices.forEach((service) => {
      if (counts[service.status] !== undefined) counts[service.status] += 1;
    });

    return counts;
  }, [statusBaseServices]);

  const metrics = useMemo(() => {
    const visibleIds = new Set(filteredServices.map((service) => service.id));
    const operativeServices = filteredServices.filter((service) => service.status !== "cancelado");
    const serviceValue = operativeServices.reduce(
      (total, service) => total + moneyValue(service.valor, service.moeda),
      0
    );
    const repasses = operativeServices.reduce(
      (total, service) =>
        total +
        serviceTechnicians(service).reduce(
          (sum, link) => sum + moneyValue(link.valor_repasse, link.moeda || service.moeda),
          0
        ),
      0
    );

    let pendingRevenue = 0;
    let pendingTechnicians = 0;

    services.forEach((service) => {
      if (!visibleIds.has(service.id)) return;
      autoMovements(service).forEach((movement) => {
        if (isSettledStatus(movement.status)) return;
        if (isRevenue(movement)) pendingRevenue += moneyValue(movement.valor, movement.moeda);
        if (isExpense(movement)) pendingTechnicians += moneyValue(movement.valor, movement.moeda);
      });
    });

    return {
      count: filteredServices.length,
      serviceValue,
      pendingRevenue,
      pendingTechnicians,
      grossResult: serviceValue - repasses,
    };
  }, [filteredServices, moneyValue, services]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / pageSize));

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setPage(1));

    return () => cancelAnimationFrame(frameId);
  }, [search, statusFilter, officeFilter, technicianFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setPage((current) => Math.min(current, totalPages));
    });

    return () => cancelAnimationFrame(frameId);
  }, [totalPages]);

  const pagedServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, page, pageSize]);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  );

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    officeFilter !== "all" ||
    technicianFilter !== "all" ||
    periodPreset !== "month";

  const formRepasseRows = useMemo(() => {
    return form.technician_ids.map((technicianId) => {
      const technician = techniciansById.get(technicianId);
      const percentage = safeNumber(form.percentages[technicianId]);
      const repasse = roundMoney((safeNumber(form.valor) * percentage) / 100);
      return { technicianId, technician, percentage, repasse };
    });
  }, [form.percentages, form.technician_ids, form.valor, techniciansById]);

  const formRepasseTotal = useMemo(
    () => formRepasseRows.reduce((total, row) => total + row.repasse, 0),
    [formRepasseRows]
  );

  const formPercentageTotal = useMemo(
    () => formRepasseRows.reduce((total, row) => total + row.percentage, 0),
    [formRepasseRows]
  );

  const editingFinancialLocked = Boolean(editingService && hasSettledFinancial(editingService));

  function changePeriodPreset(value) {
    setPeriodPreset(value);
    if (value === "custom") return;
    const range = getPresetRange(value, meRef.current?.configuracao?.timezone || me?.configuracao?.timezone);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function resetFilters() {
    const range = getPresetRange("month", meRef.current?.configuracao?.timezone || me?.configuracao?.timezone);
    setSearch("");
    setStatusFilter("all");
    setOfficeFilter("all");
    setTechnicianFilter("all");
    setPeriodPreset("month");
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function openCreate() {
    setEditingService(null);
    setForm(createServiceForm(meRef.current?.configuracao?.timezone || me?.configuracao?.timezone));
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(service) {
    const percentages = {};
    const technicianIds = serviceTechnicians(service).map((link) => {
      percentages[link.tecnico_id] = String(safeNumber(link.percentual));
      return link.tecnico_id;
    });

    setEditingService(service);
    setForm({
      status: service.status || "agendado",
      data_servico: service.data_servico || todayISO(meRef.current?.configuracao?.timezone || me?.configuracao?.timezone),
      oficina_id: service.oficina_id || "",
      vehicleMode: "existing",
      veiculo_id: service.veiculo_id || "",
      valor: moneyValue(service.valor, service.moeda),
      technician_ids: technicianIds,
      percentages,
      descricao: service.descricao || "",
      observacoes: service.observacoes || "",
      newVehicle: {
        placa: "",
        marca: "",
        modelo: "",
        ano: "",
        cor: "",
      },
    });
    setFormErrors({});
    setDetailOpen(false);
    setFormOpen(true);
  }

  const closeForm = useCallback(() => {
    if (saving) return;
    setFormOpen(false);
    setEditingService(null);
    setFormErrors({});
  }, [saving]);

  function updateTechnicianSelection(ids) {
    setForm((current) => {
      const percentages = { ...current.percentages };

      ids.forEach((id) => {
        if (percentages[id] === undefined) percentages[id] = "";
      });

      Object.keys(percentages).forEach((id) => {
        if (!ids.includes(id)) delete percentages[id];
      });

      return { ...current, technician_ids: ids, percentages };
    });
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.oficina_id) nextErrors.oficina_id = "Selecione a oficina.";
    if (!form.data_servico) nextErrors.data_servico = "Informe a data do serviço.";
    if (!SERVICE_STATUSES.includes(form.status)) nextErrors.status = "Selecione um status válido.";
    if (safeNumber(form.valor) <= 0) nextErrors.valor = "Informe um valor maior que zero.";

    if (form.vehicleMode === "existing") {
      if (!form.veiculo_id) nextErrors.veiculo_id = "Selecione um veículo.";
    } else {
      if (!normalizePlate(form.newVehicle.placa)) nextErrors.vehicle_plate = "Informe a placa.";
      if (!cleanText(form.newVehicle.marca)) nextErrors.vehicle_brand = "Informe a marca.";
      if (!cleanText(form.newVehicle.modelo)) nextErrors.vehicle_model = "Informe o modelo.";

      if (form.newVehicle.ano) {
        const year = Number(form.newVehicle.ano);
        const limit = new Date().getFullYear() + 1;
        if (!Number.isInteger(year) || year < 1886 || year > limit) {
          nextErrors.vehicle_year = "Informe um ano válido.";
        }
      }
    }

    if (!form.technician_ids.length) {
      nextErrors.technicians = "Selecione pelo menos um técnico.";
    }

    form.technician_ids.forEach((technicianId) => {
      const percentage = safeNumber(form.percentages[technicianId]);
      if (percentage <= 0 || percentage > 100) {
        nextErrors[`percentage_${technicianId}`] = "Use um percentual entre 0 e 100.";
      }
    });

    if (formPercentageTotal > 100) {
      nextErrors.technicians = "A soma dos percentuais não pode ultrapassar 100%.";
    }

    if (editingFinancialLocked && form.status === "cancelado") {
      nextErrors.status = "Serviço com movimentação paga/recebida não pode ser cancelado.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function logAudit({ action, serviceId, description, before = null, after = null }) {
    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;
    if (!currentContaId) return;

    try {
      const { error: auditError } = await supabase.from("auditoria").insert({
        conta_id: currentContaId,
        usuario_id: currentUsuarioId || null,
        entidade: "servicos",
        acao: action,
        registro_id: serviceId || null,
        descricao: description,
        dados_anteriores: before,
        dados_novos: after,
      });

      if (auditError) throw auditError;
    } catch (auditError) {
      console.warn("Auditoria de serviço não registrada", auditError);
    }
  }

  async function resolveVehicle(currentContaId, currentUsuarioId) {
    if (form.vehicleMode === "existing") {
      const vehicle = vehicles.find((item) => item.id === form.veiculo_id);
      if (!vehicle) throw new Error("Veículo selecionado não foi encontrado.");
      return { vehicle, createdVehicleId: null };
    }

    const plate = normalizePlate(form.newVehicle.placa);
    const existing = vehicles.find((item) => normalizePlate(item.placa) === plate);
    if (existing) return { vehicle: existing, createdVehicleId: null };

    const payload = {
      conta_id: currentContaId,
      placa: plate,
      marca: cleanText(form.newVehicle.marca),
      modelo: cleanText(form.newVehicle.modelo),
      ano: form.newVehicle.ano ? Number(form.newVehicle.ano) : null,
      cor: cleanText(form.newVehicle.cor),
      created_by: currentUsuarioId || null,
      updated_by: currentUsuarioId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error: vehicleError } = await supabase
      .from("veiculos")
      .insert(payload)
      .select("id,conta_id,placa,marca,modelo,ano,cor,chassi,observacoes")
      .single();

    if (vehicleError) throw vehicleError;
    return { vehicle: data, createdVehicleId: data.id };
  }

  function buildTechnicianRows(serviceId, currentContaId, currentUsuarioId) {
    return buildServiceTechnicianRows({
      serviceId,
      contaId: currentContaId,
      usuarioId: currentUsuarioId,
      serviceValue: form.valor,
      technicians: form.technician_ids.map((technicianId) => ({
        tecnico_id: technicianId,
        percentual: form.percentages[technicianId],
      })),
      currency,
    });
  }

  function buildFinancialRows({
    serviceId,
    serviceDate,
    serviceValue,
    officeId,
    vehicle,
    technicianRows,
    status,
    currentContaId,
    currentUsuarioId,
    existingMovements = [],
  }) {
    const days = meRef.current?.configuracao?.dias_vencimento_servico ?? me?.configuracao?.dias_vencimento_servico ?? 0;
    return buildServiceFinancialRows({
      serviceId,
      serviceDate,
      serviceValue,
      officeId,
      vehicle,
      technicianRows,
      techniciansById,
      status,
      contaId: currentContaId,
      usuarioId: currentUsuarioId,
      dueDays: days,
      existingMovements,
      currency,
    });
  }

  async function rebuildFinancials(args) {
    const { serviceId, currentContaId } = args;

    const { error: deleteError } = await supabase
      .from("movimentacoes_financeiras")
      .delete()
      .eq("conta_id", currentContaId)
      .eq("servico_id", serviceId)
      .in("origem", ["servico", "repasse_tecnico"]);

    if (deleteError) throw deleteError;

    const rows = buildFinancialRows(args);
    if (!rows.length) return [];

    const { data, error: insertError } = await supabase
      .from("movimentacoes_financeiras")
      .insert(rows)
      .select(
        "id,categoria_id,servico_id,tecnico_id,oficina_id,tipo,origem,descricao,valor,moeda,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,observacoes,created_by,updated_by,created_at,updated_at"
      );

    if (insertError) throw insertError;
    return data || [];
  }

  async function restoreSnapshot(service) {
    if (!service?.id || !service?.conta_id) return;

    try {
      await supabase
        .from("servicos")
        .update({
          oficina_id: service.oficina_id,
          veiculo_id: service.veiculo_id,
          data_servico: service.data_servico,
          valor: service.valor,
          moeda: service.moeda || "EUR",
          status: service.status,
          descricao: service.descricao,
          observacoes: service.observacoes,
          updated_by: service.updated_by || null,
          updated_at: service.updated_at || new Date().toISOString(),
        })
        .eq("id", service.id)
        .eq("conta_id", service.conta_id);

      await supabase
        .from("servicos_tecnicos")
        .delete()
        .eq("conta_id", service.conta_id)
        .eq("servico_id", service.id);

      const oldLinks = serviceTechnicians(service).map((link) => ({
        id: link.id,
        conta_id: service.conta_id,
        servico_id: service.id,
        tecnico_id: link.tecnico_id,
        percentual: link.percentual,
        valor_repasse: link.valor_repasse,
        moeda: link.moeda || service.moeda || "EUR",
        created_by: link.created_by || service.created_by || null,
        created_at: link.created_at || new Date().toISOString(),
      }));

      if (oldLinks.length) await supabase.from("servicos_tecnicos").insert(oldLinks);

      await supabase
        .from("movimentacoes_financeiras")
        .delete()
        .eq("conta_id", service.conta_id)
        .eq("servico_id", service.id)
        .in("origem", ["servico", "repasse_tecnico"]);

      const oldMovements = autoMovements(service).map((movement) => ({
        id: movement.id,
        conta_id: service.conta_id,
        categoria_id: movement.categoria_id || null,
        servico_id: service.id,
        tecnico_id: movement.tecnico_id || null,
        oficina_id: movement.oficina_id || service.oficina_id,
        tipo: movement.tipo,
        origem: movement.origem,
        descricao: movement.descricao,
        valor: movement.valor,
        moeda: movement.moeda || service.moeda || "EUR",
        status: movement.status,
        data_competencia: movement.data_competencia,
        data_vencimento: movement.data_vencimento,
        data_pagamento: movement.data_pagamento,
        forma_pagamento: movement.forma_pagamento,
        observacoes: movement.observacoes,
        created_by: movement.created_by || null,
        updated_by: movement.updated_by || null,
        created_at: movement.created_at || new Date().toISOString(),
        updated_at: movement.updated_at || new Date().toISOString(),
      }));

      if (oldMovements.length) {
        await supabase.from("movimentacoes_financeiras").insert(oldMovements);
      }
    } catch (restoreError) {
      console.error("Falha ao restaurar snapshot do serviço", restoreError);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!validateForm()) return;

    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;

    if (!currentContaId) {
      toast.error("Conta não identificada", "Recarregue a página e tente novamente.");
      return;
    }

    setSaving(true);
    let createdServiceId = null;
    let createdVehicleId = null;

    try {
      if (editingService && editingFinancialLocked) {
        const { data, error: updateError } = await supabase
          .from("servicos")
          .update({
            status: form.status,
            descricao: cleanText(form.descricao),
            observacoes: cleanText(form.observacoes),
            updated_by: currentUsuarioId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingService.id)
          .eq("conta_id", currentContaId)
          .select("id,status,descricao,observacoes,updated_at")
          .single();

        if (updateError) throw updateError;

        await logAudit({
          action: "atualizar",
          serviceId: editingService.id,
          description: `Serviço ${editingService.veiculo?.placa || editingService.id.slice(0, 8)} atualizado sem alterar valores financeiros já liquidados.`,
          before: {
            status: editingService.status,
            descricao: editingService.descricao,
            observacoes: editingService.observacoes,
          },
          after: data,
        });

        toast.success(
          "Serviço atualizado",
          "Status e informações operacionais foram salvos. O financeiro liquidado foi preservado."
        );
      } else {
        const { vehicle, createdVehicleId: newVehicleId } = await resolveVehicle(
          currentContaId,
          currentUsuarioId
        );
        createdVehicleId = newVehicleId;

        const servicePayload = {
          oficina_id: form.oficina_id,
          veiculo_id: vehicle.id,
          data_servico: form.data_servico,
          valor: roundMoney(form.valor),
          moeda: currency,
          status: form.status,
          descricao: cleanText(form.descricao),
          observacoes: cleanText(form.observacoes),
          updated_by: currentUsuarioId || null,
          updated_at: new Date().toISOString(),
        };

        let serviceId;

        if (editingService) {
          const { error: updateError } = await supabase
            .from("servicos")
            .update(servicePayload)
            .eq("id", editingService.id)
            .eq("conta_id", currentContaId);

          if (updateError) throw updateError;
          serviceId = editingService.id;
        } else {
          const { data, error: insertError } = await supabase
            .from("servicos")
            .insert({
              ...servicePayload,
              conta_id: currentContaId,
              created_by: currentUsuarioId || null,
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          serviceId = data.id;
          createdServiceId = data.id;
        }

        if (editingService) {
          const { error: deleteLinksError } = await supabase
            .from("servicos_tecnicos")
            .delete()
            .eq("conta_id", currentContaId)
            .eq("servico_id", serviceId);
          if (deleteLinksError) throw deleteLinksError;
        }

        const technicianRows = buildTechnicianRows(
          serviceId,
          currentContaId,
          currentUsuarioId
        );

        if (technicianRows.length) {
          const { error: linkError } = await supabase
            .from("servicos_tecnicos")
            .insert(technicianRows);
          if (linkError) throw linkError;
        }

        await rebuildFinancials({
          serviceId,
          serviceDate: form.data_servico,
          serviceValue: form.valor,
          officeId: form.oficina_id,
          vehicle,
          technicianRows,
          status: form.status,
          currentContaId,
          currentUsuarioId,
          existingMovements: editingService ? autoMovements(editingService) : [],
        });

        const auditAfter = {
          ...servicePayload,
          id: serviceId,
          tecnicos: technicianRows.map((row) => ({
            tecnico_id: row.tecnico_id,
            percentual: row.percentual,
            valor_repasse: row.valor_repasse,
            moeda: row.moeda || currency,
          })),
        };

        await logAudit({
          action: editingService ? "atualizar" : "criar",
          serviceId,
          description: editingService
            ? `Serviço ${vehicle.placa} atualizado.`
            : `Serviço ${vehicle.placa} criado com financeiro pendente.`,
          before: editingService
            ? {
                ...editingService,
                servicos_tecnicos: serviceTechnicians(editingService).map((link) => ({
                  tecnico_id: link.tecnico_id,
                  percentual: link.percentual,
                  valor_repasse: link.valor_repasse,
                  moeda: link.moeda || editingService.moeda || "EUR",
                })),
              }
            : null,
          after: auditAfter,
        });

        toast.success(
          editingService ? "Serviço atualizado" : "Serviço criado",
          form.status === "cancelado"
            ? "O serviço foi salvo como cancelado, sem gerar pendências financeiras."
            : editingService
              ? "Repasses e movimentações pendentes foram sincronizados."
              : "Recebimento da oficina e repasses dos técnicos já entraram como pendentes."
        );
      }

      setFormOpen(false);
      setEditingService(null);
      setForm(createServiceForm(currentMe?.configuracao?.timezone));
      setFormErrors({});
      await loadData({ silent: true });
    } catch (saveError) {
      console.error("Salvar serviço", saveError);

      if (editingService && !editingFinancialLocked) {
        await restoreSnapshot(editingService);
      } else if (createdServiceId) {
        await supabase
          .from("servicos")
          .delete()
          .eq("id", createdServiceId)
          .eq("conta_id", currentContaId);
      }

      if (createdVehicleId) {
        await supabase
          .from("veiculos")
          .delete()
          .eq("id", createdVehicleId)
          .eq("conta_id", currentContaId);
      }

      toast.error(
        "Não foi possível salvar",
        saveError?.message || "A operação foi revertida. Verifique os dados e tente novamente."
      );
      await loadData({ silent: true });
    } finally {
      setSaving(false);
    }
  }

  async function changeServiceStatus(service, nextStatus) {
    if (!service?.id || !SERVICE_STATUSES.includes(nextStatus) || service.status === nextStatus) return;

    if (nextStatus === "cancelado" && hasSettledFinancial(service)) {
      toast.warning(
        "Cancelamento bloqueado",
        "Este serviço já possui recebimento ou repasse liquidado. Preserve o histórico financeiro."
      );
      return;
    }

    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;
    if (!currentContaId) return;

    setStatusBusyId(service.id);

    try {
      const { error: updateError } = await supabase
        .from("servicos")
        .update({
          status: nextStatus,
          updated_by: currentUsuarioId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", service.id)
        .eq("conta_id", currentContaId);

      if (updateError) throw updateError;

      if (!hasSettledFinancial(service)) {
        const technicianRows = serviceTechnicians(service).map((link) => ({
          tecnico_id: link.tecnico_id,
          percentual: safeNumber(link.percentual),
          valor_repasse: roundMoney(link.valor_repasse),
        }));

        await rebuildFinancials({
          serviceId: service.id,
          serviceDate: service.data_servico,
          serviceValue: service.valor,
          officeId: service.oficina_id,
          vehicle: service.veiculo,
          technicianRows,
          status: nextStatus,
          currentContaId,
          currentUsuarioId,
          existingMovements: autoMovements(service),
        });
      }

      await logAudit({
        action: "alterar_status",
        serviceId: service.id,
        description: `Status do serviço ${service.veiculo?.placa || service.id.slice(0, 8)} alterado de ${STATUS_META[service.status]?.label || service.status} para ${STATUS_META[nextStatus].label}.`,
        before: { status: service.status },
        after: { status: nextStatus },
      });

      toast.success("Status atualizado", `Serviço marcado como ${STATUS_META[nextStatus].label.toLowerCase()}.`);
      await loadData({ silent: true });
    } catch (statusError) {
      console.error("Alterar status do serviço", statusError);

      try {
        await supabase
          .from("servicos")
          .update({ status: service.status, updated_at: new Date().toISOString() })
          .eq("id", service.id)
          .eq("conta_id", currentContaId);
        await restoreSnapshot(service);
      } catch {
        // Melhor esforço de rollback.
      }

      toast.error(
        "Não foi possível alterar o status",
        statusError?.message || "A alteração foi revertida. Tente novamente."
      );
      await loadData({ silent: true });
    } finally {
      setStatusBusyId("");
    }
  }

  function openDetail(service) {
    setSelectedService(service);
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!selectedService) return;
    const fresh = services.find((service) => service.id === selectedService.id);
    if (!fresh) return;

    const frameId = requestAnimationFrame(() => setSelectedService(fresh));

    return () => cancelAnimationFrame(frameId);
  }, [services, selectedService]);

  async function confirmDelete() {
    if (!deleteTarget || !contaId) return;

    if (hasSettledFinancial(deleteTarget)) {
      toast.warning(
        "Exclusão bloqueada",
        "Este serviço possui movimentação já recebida ou paga. Para preservar o histórico, não exclua o registro."
      );
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);

    try {
      const before = {
        ...deleteTarget,
        servicos_tecnicos: serviceTechnicians(deleteTarget).map((link) => ({
          tecnico_id: link.tecnico_id,
          percentual: link.percentual,
          valor_repasse: link.valor_repasse,
        })),
        movimentacoes_financeiras: autoMovements(deleteTarget),
      };

      const { error: deleteError } = await supabase
        .from("servicos")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("conta_id", contaId);

      if (deleteError) throw deleteError;

      await logAudit({
        action: "excluir",
        serviceId: deleteTarget.id,
        description: `Serviço ${deleteTarget.veiculo?.placa || deleteTarget.id.slice(0, 8)} excluído com suas pendências automáticas.`,
        before,
      });

      if (selectedService?.id === deleteTarget.id) {
        setDetailOpen(false);
        setSelectedService(null);
      }

      setDeleteTarget(null);
      toast.success(
        "Serviço excluído",
        "Relações com técnicos e movimentações financeiras pendentes foram removidas junto com o serviço."
      );
      await loadData({ silent: true });
    } catch (deleteError) {
      console.error("Excluir serviço", deleteError);
      toast.error(
        "Não foi possível excluir",
        deleteError?.message || "Tente novamente."
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedRevenue = selectedService ? revenueMovement(selectedService) : null;
  const selectedLinks = selectedService ? serviceTechnicians(selectedService) : [];
  const selectedServiceValue = selectedService
    ? moneyValue(selectedService.valor, selectedService.moeda)
    : 0;
  const selectedRepasseTotal = selectedService
    ? serviceRepasseTotal(selectedService, moneyValue)
    : 0;
  const selectedGross = selectedService ? selectedServiceValue - selectedRepasseTotal : 0;
  const selectedMargin =
    selectedService && selectedServiceValue > 0
      ? (selectedGross / selectedServiceValue) * 100
      : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Controle a operação do serviço até o recebimento e o repasse do técnico.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Serviços
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
          <Button leftIcon={Plus} onClick={openCreate}>
            Novo serviço
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Serviços no filtro"
          value={metrics.count}
          caption="Quantidade exibida neste recorte"
          icon={Wrench}
        />
        <MetricCard
          label="Valor operacional"
          value={formatMoney(metrics.serviceValue)}
          caption="Serviços não cancelados no filtro"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="A receber"
          value={formatMoney(metrics.pendingRevenue)}
          caption="Receitas automáticas ainda pendentes"
          icon={WalletCards}
          tone={metrics.pendingRevenue ? "warning" : "success"}
        />
        <MetricCard
          label="Repasses pendentes"
          value={formatMoney(metrics.pendingTechnicians)}
          caption={`Resultado bruto: ${formatMoney(metrics.grossResult)}`}
          icon={Banknote}
          tone={metrics.pendingTechnicians ? "warning" : "success"}
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 pr-2 text-sm font-medium text-foreground">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <Filter className="size-4" strokeWidth={1.8} />
            </span>
            Filtros
          </div>

          <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Placa, veículo, oficina, técnico..."
                className="pl-9"
              />
            </div>

            <SearchableSelect
              value={officeFilter === "all" ? "" : officeFilter}
              onChange={(value) => setOfficeFilter(value || "all")}
              options={offices.map((office) => ({ value: office.id, label: office.nome }))}
              placeholder="Todas as oficinas"
              searchPlaceholder="Buscar oficina..."
            />

            <SearchableSelect
              value={technicianFilter === "all" ? "" : technicianFilter}
              onChange={(value) => setTechnicianFilter(value || "all")}
              options={technicians.map((technician) => ({
                value: technician.id,
                label: technician.nome,
              }))}
              placeholder="Todos os técnicos"
              searchPlaceholder="Buscar técnico..."
            />

            <Select value={periodPreset} onChange={(event) => changePeriodPreset(event.target.value)}>
              <option value="today">Hoje</option>
              <option value="week">Esta semana</option>
              <option value="month">Este mês</option>
              <option value="previous_month">Mês anterior</option>
              <option value="year">Este ano</option>
              <option value="custom">Período personalizado</option>
            </Select>
          </div>

          {hasActiveFilters ? (
            <Button variant="ghost" leftIcon={X} onClick={resetFilters}>
              Limpar
            </Button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-center">
          <DateInput
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPeriodPreset("custom");
            }}
          />
          <DateInput
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPeriodPreset("custom");
            }}
          />
          <p className="text-xs text-muted-foreground xl:text-right">
            Os indicadores e os status abaixo acompanham este mesmo recorte.
          </p>
        </div>
      </section>

      <section className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
        <div className="grid min-w-[820px] grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className={`rounded-xl border p-3 text-left transition sm:p-4 ${
              statusFilter === "all"
                ? "border-primary bg-primary/10"
                : "border-border bg-surface hover:bg-surface-2/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-foreground">
                <Gauge className="size-4" strokeWidth={1.8} />
              </span>
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                {statusCounts.all}
              </span>
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">Todos</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Visão completa</p>
          </button>

          {SERVICE_STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            const active = statusFilter === status;

            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-left transition sm:p-4 ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-2/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`grid size-8 place-items-center rounded-lg ${meta.badgeClass}`}>
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="text-2xl font-semibold tracking-tight text-foreground">
                    {statusCounts[status]}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{meta.shortLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {status === "agendado"
                    ? "Ainda não iniciado"
                    : status === "em_andamento"
                      ? "Execução ativa"
                      : status === "concluido"
                        ? "Serviço finalizado"
                        : "Sem financeiro pendente"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Falha ao carregar os serviços</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      {loading ? (
        <ServiceListSkeleton />
      ) : filteredServices.length ? (
        <ServiceTable
          services={pagedServices}
          photoMap={photoMap}
          formatMoney={formatMoney}
          moneyValue={moneyValue}
          formatServiceDate={formatServiceDate}
          onOpen={openDetail}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onStatusChange={changeServiceStatus}
          statusBusyId={statusBusyId}
        />
      ) : (
        <section className="rounded-xl border border-border bg-surface px-4 py-12 text-center sm:px-6">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <Wrench className="size-6" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-foreground">Nenhum serviço encontrado</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ajuste os filtros ou cadastre o próximo serviço da operação.
          </p>
          <div className="mt-5 flex justify-center">
            <Button leftIcon={Plus} onClick={openCreate}>
              Novo serviço
            </Button>
          </div>
        </section>
      )}

      {!loading && filteredServices.length ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-foreground">
                {(page - 1) * pageSize + 1}
              </strong>{" "}
              a{" "}
              <strong className="font-semibold text-foreground">
                {Math.min(page * pageSize, filteredServices.length)}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-foreground">{filteredServices.length}</strong>
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

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingService ? "Editar serviço" : "Novo serviço"}
        description={
          editingFinancialLocked
            ? "Este serviço possui movimentação financeira liquidada. Valor, veículo, oficina, data e técnicos ficam protegidos."
            : "Cadastre o atendimento e o sistema gera automaticamente o recebimento e os repasses pendentes."
        }
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="service-form"
              loading={saving}
              leftIcon={editingService ? Pencil : Plus}
            >
              {editingService ? "Salvar alterações" : "Criar serviço"}
            </Button>
          </>
        }
      >
        <Form id="service-form" onSubmit={handleSave}>
          {editingFinancialLocked ? (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.8} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Financeiro protegido</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Como já existe recebimento ou repasse liquidado, esta edição pode alterar apenas status,
                    descrição e observações. Assim você não reescreve um valor que já virou histórico.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <FormSection
            title="Operação"
            description="Onde, quando e em qual etapa este serviço está."
          >
            <FormGrid>
              <FormField label="Oficina" required error={formErrors.oficina_id}>
                <SearchableSelect
                  value={form.oficina_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, oficina_id: value || "" }))
                  }
                  options={officeOptions}
                  placeholder="Selecione a oficina"
                  searchPlaceholder="Buscar oficina..."
                  disabled={editingFinancialLocked}
                />
              </FormField>

              <FormField label="Data do serviço" required error={formErrors.data_servico}>
                <DateInput
                  value={form.data_servico}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, data_servico: event.target.value }))
                  }
                  disabled={editingFinancialLocked}
                />
              </FormField>

              <FormField label="Status" required error={formErrors.status}>
                <Select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value }))
                  }
                >
                  {SERVICE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_META[status].label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Valor do serviço" required error={formErrors.valor}>
                <CurrencyInput
                  value={form.valor}
                  onValueChange={(value) => setForm((current) => ({ ...current, valor: value }))}
                  currency={currency}
                  locale={locale}
                  disabled={editingFinancialLocked}
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Veículo"
            description="Use um veículo já cadastrado ou faça o cadastro rápido sem sair do serviço."
          >
            {!editingFinancialLocked ? (
              <div className="mb-4 inline-flex rounded-lg border border-border bg-background p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={form.vehicleMode === "existing" ? "primary" : "ghost"}
                  onClick={() =>
                    setForm((current) => ({ ...current, vehicleMode: "existing" }))
                  }
                >
                  Veículo existente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.vehicleMode === "new" ? "primary" : "ghost"}
                  onClick={() => setForm((current) => ({ ...current, vehicleMode: "new" }))}
                >
                  Cadastro rápido
                </Button>
              </div>
            ) : null}

            {form.vehicleMode === "existing" || editingFinancialLocked ? (
              <FormField label="Veículo" required error={formErrors.veiculo_id}>
                <SearchableSelect
                  value={form.veiculo_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, veiculo_id: value || "" }))
                  }
                  options={vehicleOptions}
                  placeholder="Pesquise pela placa ou modelo"
                  searchPlaceholder="Buscar placa, marca ou modelo..."
                  disabled={editingFinancialLocked}
                />
              </FormField>
            ) : (
              <FormGrid>
                <FormField label="Placa" required error={formErrors.vehicle_plate}>
                  <Input
                    value={form.newVehicle.placa}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newVehicle: {
                          ...current.newVehicle,
                          placa: normalizePlate(event.target.value),
                        },
                      }))
                    }
                    placeholder="Ex.: HC287KC"
                  />
                </FormField>

                <FormField label="Marca" required error={formErrors.vehicle_brand}>
                  <Input
                    value={form.newVehicle.marca}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newVehicle: { ...current.newVehicle, marca: event.target.value },
                      }))
                    }
                    placeholder="Renault"
                  />
                </FormField>

                <FormField label="Modelo" required error={formErrors.vehicle_model}>
                  <Input
                    value={form.newVehicle.modelo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newVehicle: { ...current.newVehicle, modelo: event.target.value },
                      }))
                    }
                    placeholder="Captur"
                  />
                </FormField>

                <FormField label="Ano" error={formErrors.vehicle_year}>
                  <Input
                    inputMode="numeric"
                    value={form.newVehicle.ano}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newVehicle: {
                          ...current.newVehicle,
                          ano: event.target.value.replace(/\D/g, "").slice(0, 4),
                        },
                      }))
                    }
                    placeholder="2024"
                  />
                </FormField>

                <FormField label="Cor">
                  <Input
                    value={form.newVehicle.cor}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        newVehicle: { ...current.newVehicle, cor: event.target.value },
                      }))
                    }
                    placeholder="Preto"
                  />
                </FormField>
              </FormGrid>
            )}
          </FormSection>

          <FormSection
            title="Técnicos e repasses"
            description="Selecione os responsáveis e defina o percentual específico deste serviço."
          >
            <FormField label="Técnicos" required error={formErrors.technicians}>
              <MultiSelect
                value={form.technician_ids}
                onChange={updateTechnicianSelection}
                options={technicianOptions}
                placeholder="Selecione os técnicos"
                searchPlaceholder="Buscar técnico..."
                disabled={editingFinancialLocked}
              />
            </FormField>

            {formRepasseRows.length ? (
              <div className="mt-4 space-y-2">
                {formRepasseRows.map((row) => (
                  <div
                    key={row.technicianId}
                    className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_150px_150px] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <TechnicianAvatar
                        technician={row.technician}
                        photoUrl={photoMap.get(row.technicianId)}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {row.technician?.nome || "Técnico"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {linkedTechnicianIds.has(row.technicianId)
                            ? "Vinculado a esta oficina"
                            : "Disponível na conta"}
                        </p>
                      </div>
                    </div>

                    <FormField error={formErrors[`percentage_${row.technicianId}`]}>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          inputMode="decimal"
                          value={form.percentages[row.technicianId] ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              percentages: {
                                ...current.percentages,
                                [row.technicianId]: event.target.value,
                              },
                            }))
                          }
                          placeholder="Percentual"
                          className="pr-8"
                          disabled={editingFinancialLocked}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                    </FormField>

                    <div className="rounded-lg bg-surface-2 px-3 py-2.5 sm:text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Repasse
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {formatMoney(row.repasse)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Percentual distribuído</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formPercentageTotal.toLocaleString(locale, { maximumFractionDigits: 2 })}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de repasses</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMoney(formRepasseTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resultado bruto previsto</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMoney(Math.max(0, safeNumber(form.valor) - formRepasseTotal))}
                </p>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Detalhes"
            description="Informações livres para facilitar a leitura futura do atendimento."
          >
            <FormField label="Descrição do serviço">
              <Input
                value={form.descricao}
                onChange={(event) =>
                  setForm((current) => ({ ...current, descricao: event.target.value }))
                }
                placeholder="Ex.: Reparo de porta dianteira e paralama"
              />
            </FormField>

            <FormField label="Observações">
              <Textarea
                rows={4}
                value={form.observacoes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, observacoes: event.target.value }))
                }
                placeholder="Observações internas sobre o atendimento..."
              />
            </FormField>
          </FormSection>

        </Form>
      </Modal>

      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalhes do serviço"
        description={selectedService ? `${selectedService.veiculo?.placa || "Sem placa"} · ${formatServiceDate(selectedService.data_servico)}` : ""}
        footer={
          selectedService ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                leftIcon={Trash2}
                onClick={() => {
                  setDetailOpen(false);
                  setDeleteTarget(selectedService);
                }}
              >
                Excluir
              </Button>
              <Button leftIcon={Pencil} onClick={() => openEdit(selectedService)}>
                Editar serviço
              </Button>
            </div>
          ) : null
        }
      >
        {selectedService ? (
          <div className="space-y-5 pb-2">
            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <Car className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        {vehicleName(selectedService.veiculo)}
                      </h2>
                      <StatusBadge status={selectedService.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[selectedService.veiculo?.placa, selectedService.veiculo?.ano, selectedService.veiculo?.cor]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Valor do serviço</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    {formatMoney(selectedService.valor, selectedService.moeda)}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-4" strokeWidth={1.8} />
                  Oficina
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {selectedService.oficina?.nome || "Não informada"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[selectedService.oficina?.cidade, selectedService.oficina?.estado_regiao]
                    .filter(Boolean)
                    .join(" · ") || "Localização não informada"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-4" strokeWidth={1.8} />
                  Data do serviço
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatServiceDate(selectedService.data_servico)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastro em {formatDateTime(selectedService.created_at)}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Técnicos e repasses</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Percentuais são específicos deste serviço.
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(selectedRepasseTotal)}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {selectedLinks.length ? (
                  selectedLinks.map((link) => {
                    const movement = technicianMovement(selectedService, link.tecnico_id);
                    return (
                      <div
                        key={link.id || link.tecnico_id}
                        className="grid gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <TechnicianAvatar
                            technician={link.tecnico}
                            photoUrl={photoMap.get(link.tecnico_id)}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {link.tecnico?.nome || "Técnico"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {safeNumber(link.percentual).toLocaleString(locale, {
                                maximumFractionDigits: 2,
                              })}% do serviço
                            </p>
                          </div>
                        </div>
                        <FinanceBadge movement={movement} />
                        <p className="text-sm font-semibold text-foreground sm:text-right">
                          {formatMoney(link.valor_repasse, link.moeda || selectedService?.moeda)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum técnico relacionado.</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <WalletCards className="size-5" strokeWidth={1.8} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Financeiro do serviço</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Recebimento da oficina e pagamentos aos técnicos.
                  </p>
                </div>
              </div>

              {selectedService.status === "cancelado" ? (
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium text-foreground">Serviço cancelado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Não existem pendências automáticas de recebimento ou repasse para este serviço.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Recebimento da oficina</p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {formatMoney(selectedRevenue?.valor ?? selectedService.valor, selectedRevenue?.moeda || selectedService.moeda)}
                        </p>
                      </div>
                      <FinanceBadge movement={selectedRevenue} />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Vencimento: {selectedRevenue?.data_vencimento ? formatServiceDate(selectedRevenue.data_vencimento) : "não definido"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium text-muted-foreground">Repasses dos técnicos</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatMoney(selectedRepasseTotal)}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {selectedLinks.filter((link) => {
                        const movement = technicianMovement(selectedService, link.tecnico_id);
                        return movement && !isSettledStatus(movement.status);
                      }).length} pendente(s) de {selectedLinks.length}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Receita</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMoney(selectedService.status === "cancelado" ? 0 : selectedService.valor, selectedService.moeda)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Repasses</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMoney(selectedService.status === "cancelado" ? 0 : selectedRepasseTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs text-muted-foreground">Resultado bruto</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMoney(selectedService.status === "cancelado" ? 0 : selectedGross)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedService.status === "cancelado"
                    ? "Serviço cancelado"
                    : `${selectedMargin.toLocaleString(locale, { maximumFractionDigits: 1 })}% de margem`}
                </p>
              </div>
            </section>

            {selectedService.descricao || selectedService.observacoes ? (
              <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <FileText className="size-4" strokeWidth={1.8} />
                  <p className="text-sm font-semibold text-foreground">Informações do atendimento</p>
                </div>
                {selectedService.descricao ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selectedService.descricao}
                    </p>
                  </div>
                ) : null}
                {selectedService.observacoes ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Observações</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selectedService.observacoes}
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <UserRound className="size-4" strokeWidth={1.8} />
                Registro
              </div>
              <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                <p>
                  Criado: <span className="font-medium text-foreground">{formatDateTime(selectedService.created_at)}</span>
                </p>
                <p>
                  Atualizado: <span className="font-medium text-foreground">{formatDateTime(selectedService.updated_at)}</span>
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="Excluir serviço"
        description="A exclusão remove o serviço, suas relações com técnicos e as movimentações automáticas ainda pendentes."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} leftIcon={Trash2} onClick={confirmDelete}>
              Excluir serviço
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deseja realmente excluir o serviço do veículo{" "}
            <strong className="font-semibold text-foreground">
              {deleteTarget?.veiculo?.placa || "selecionado"}
            </strong>
            ?
          </p>

          {deleteTarget && hasSettledFinancial(deleteTarget) ? (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-sm font-medium text-foreground">Este serviço não pode ser excluído.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Há recebimento ou repasse já liquidado. O histórico financeiro precisa ser preservado.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
              Como as movimentações estão pendentes, o banco poderá removê-las em cascata junto com o serviço.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
