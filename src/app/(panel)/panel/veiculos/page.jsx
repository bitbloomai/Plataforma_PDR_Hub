"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Gauge,
  Hash,
  History,
  Palette,
  RefreshCw,
  Repeat2,
  Search,
  ScanLine,
  Wrench,
  X,
} from "lucide-react";

import { Button, Drawer, Input, Select, Table } from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayMoney, moneyFromStorage, withSourceCurrency } from "@/lib/currency";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/formatters";

const PAGE_SIZES = [12, 24, 48];

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function displayText(value, fallback = "Não informado") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function plateLabel(value) {
  const text = String(value ?? "").trim();
  return text ? text.toUpperCase() : "SEM PLACA";
}

function dateCountry(locale) {
  return String(locale || "")
    .toLowerCase()
    .includes("br")
    ? "BR"
    : "IT";
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

function uniqueById(items) {
  const map = new Map();

  items.forEach((item) => {
    if (!item?.id) return;
    if (!map.has(item.id)) map.set(item.id, item);
  });

  return [...map.values()];
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

function getServiceTechnicians(service) {
  return (service?.servicos_tecnicos || [])
    .map((link) => ({
      ...link,
      tecnico: link?.tecnico || null,
    }))
    .filter((link) => link.tecnico?.id || link.tecnico_id);
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

function InfoItem({ icon: Icon, label, value, children }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background p-3.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" strokeWidth={1.8} /> : null}
        {label}
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-foreground">
        {children ?? displayText(value)}
      </div>
    </div>
  );
}

function DetailMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" strokeWidth={1.8} />
        {label}
      </div>
      <p className="mt-1.5 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function VeiculosPage() {
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);

  const [me, setMe] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

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

        const [vehiclesResult, servicesResult] = await Promise.all([
          supabase
            .from("veiculos")
            .select(
              "id,conta_id,placa,marca,modelo,ano,cor,chassi,observacoes,created_by,updated_by,created_at,updated_at"
            )
            .eq("conta_id", currentContaId)
            .order("placa", { ascending: true })
            .range(0, 4999),
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
                descricao,
                observacoes,
                created_by,
                updated_by,
                created_at,
                updated_at,
                oficina:oficinas(id,nome,cidade,estado_regiao),
                servicos_tecnicos(
                  id,
                  tecnico_id,
                  percentual,
                  valor_repasse,
                  moeda,
                  tecnico:tecnicos(id,nome,ativo)
                )
              `
            )
            .eq("conta_id", currentContaId)
            .order("data_servico", { ascending: false })
            .order("created_at", { ascending: false })
            .range(0, 4999),
        ]);

        if (vehiclesResult.error) throw vehiclesResult.error;
        if (servicesResult.error) throw servicesResult.error;

        setMe(meData);
        setVehicles(vehiclesResult.data || []);
        setServices(servicesResult.data || []);
      } catch (loadError) {
        console.error("Veículos load", loadError);
        const message = loadError?.message || "Não foi possível carregar os veículos.";
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

  const locale = me?.configuracao?.locale || "it-IT";
  const dateRegion = dateCountry(locale);

  const formatMoney = useCallback(
    (value, sourceCurrency) =>
      formatDisplayMoney(value, withSourceCurrency(me?.configuracao, sourceCurrency || me?.configuracao?.moeda)),
    [me?.configuracao]
  );

  const moneyValue = useCallback(
    (value, sourceCurrency) => moneyFromStorage(value, withSourceCurrency(me?.configuracao, sourceCurrency), sourceCurrency),
    [me?.configuracao]
  );

  const formatDateTime = useCallback(
    (value) => {
      if (!value) return "Não informado";

      try {
        return new Intl.DateTimeFormat(me?.configuracao?.locale || "it-IT", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: me?.configuracao?.timezone || "Europe/Rome",
        }).format(new Date(value));
      } catch {
        return String(value);
      }
    },
    [me]
  );

  const formatPercent = useCallback(
    (value) => {
      try {
        return `${new Intl.NumberFormat(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(safeNumber(value))}%`;
      } catch {
        return `${safeNumber(value)}%`;
      }
    },
    [locale]
  );

  const servicesByVehicle = useMemo(() => {
    const map = new Map();

    services.forEach((service) => {
      if (!service?.veiculo_id) return;
      if (!map.has(service.veiculo_id)) map.set(service.veiculo_id, []);
      map.get(service.veiculo_id).push(service);
    });

    return map;
  }, [services]);

  const vehicleRows = useMemo(() => {
    return vehicles.map((vehicle) => {
      const history = servicesByVehicle.get(vehicle.id) || [];
      const latestService = history[0] || null;
      const totalValue = history.reduce((sum, service) => sum + moneyValue(service.valor, service.moeda), 0);

      const historicalOffices = uniqueById(
        history.map((service) => service.oficina).filter(Boolean)
      );

      const historicalTechnicians = uniqueById(
        history.flatMap((service) =>
          getServiceTechnicians(service)
            .map((link) => link.tecnico)
            .filter(Boolean)
        )
      );

      const latestTechnicians = uniqueById(
        getServiceTechnicians(latestService)
          .map((link) => link.tecnico)
          .filter(Boolean)
      );

      const vehicleName = [vehicle.marca, vehicle.modelo].filter(Boolean).join(" ");
      const latestTechnicianNames = latestTechnicians.map((item) => item.nome).filter(Boolean);

      const searchText = [
        vehicle.placa,
        vehicle.marca,
        vehicle.modelo,
        vehicle.ano,
        vehicle.cor,
        vehicle.chassi,
        vehicle.observacoes,
        ...historicalOffices.flatMap((office) => [
          office.nome,
          office.cidade,
          office.estado_regiao,
        ]),
        ...historicalTechnicians.map((technician) => technician.nome),
      ]
        .filter(Boolean)
        .join(" ");

      return {
        id: vehicle.id,
        vehicle,
        placa: plateLabel(vehicle.placa),
        vehicleName: vehicleName || "Veículo sem descrição",
        anoCor: [vehicle.ano, vehicle.cor].filter(Boolean).join(" • ") || "Não informado",
        ultimaOficina: latestService?.oficina?.nome || "Sem atendimento",
        ultimosTecnicos: latestTechnicianNames.join(", ") || "Não informado",
        totalServicos: history.length,
        valorAcumulado: totalValue,
        ultimoAtendimento: latestService?.data_servico || "",
        latestService,
        services: history,
        historicalOffices,
        historicalTechnicians,
        officeIds: new Set(history.map((service) => service.oficina_id).filter(Boolean)),
        technicianIds: new Set(
          history.flatMap((service) =>
            getServiceTechnicians(service)
              .map((link) => link.tecnico_id || link.tecnico?.id)
              .filter(Boolean)
          )
        ),
        normalizedSearch: normalizeText(searchText),
        compactSearch: normalizeCompact(searchText),
      };
    });
  }, [moneyValue, servicesByVehicle, vehicles]);

  const offices = useMemo(() => {
    const map = new Map();

    services.forEach((service) => {
      if (service?.oficina?.id && !map.has(service.oficina.id)) {
        map.set(service.oficina.id, service.oficina);
      }
    });

    return [...map.values()].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), locale, {
        sensitivity: "base",
      })
    );
  }, [locale, services]);

  const technicians = useMemo(() => {
    const map = new Map();

    services.forEach((service) => {
      getServiceTechnicians(service).forEach((link) => {
        if (link?.tecnico?.id && !map.has(link.tecnico.id)) {
          map.set(link.tecnico.id, link.tecnico);
        }
      });
    });

    return [...map.values()].sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), locale, {
        sensitivity: "base",
      })
    );
  }, [locale, services]);

  const metrics = useMemo(() => {
    const totalServices = vehicleRows.reduce((sum, row) => sum + row.totalServicos, 0);
    const recurring = vehicleRows.filter((row) => row.totalServicos >= 2).length;
    const totalValue = vehicleRows.reduce((sum, row) => sum + row.valorAcumulado, 0);

    return {
      vehicles: vehicleRows.length,
      services: totalServices,
      recurring,
      totalValue,
    };
  }, [vehicleRows]);

  const filteredRows = useMemo(() => {
    const term = normalizeText(search);
    const compactTerm = normalizeCompact(search);

    return vehicleRows.filter((row) => {
      if (officeFilter !== "all" && !row.officeIds.has(officeFilter)) return false;
      if (technicianFilter !== "all" && !row.technicianIds.has(technicianFilter)) {
        return false;
      }

      if (frequencyFilter === "recurrent" && row.totalServicos < 2) return false;
      if (frequencyFilter === "single" && row.totalServicos !== 1) return false;
      if (frequencyFilter === "none" && row.totalServicos !== 0) return false;

      if (!term) return true;

      return (
        row.normalizedSearch.includes(term) ||
        (compactTerm && row.compactSearch.includes(compactTerm))
      );
    });
  }, [frequencyFilter, officeFilter, search, technicianFilter, vehicleRows]);

  const sortedRows = useMemo(() => {
    if (!sort?.key) return filteredRows;

    const multiplier = sort.direction === "desc" ? -1 : 1;

    return [...filteredRows].sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * multiplier;
      }

      return (
        String(aValue).localeCompare(String(bValue), locale, {
          numeric: true,
          sensitivity: "base",
        }) * multiplier
      );
    });
  }, [filteredRows, locale, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setPage(1));

    return () => cancelAnimationFrame(frameId);
  }, [frequencyFilter, officeFilter, pageSize, search, technicianFilter]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setPage((current) => Math.min(current, totalPages));
    });

    return () => cancelAnimationFrame(frameId);
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [page, pageSize, sortedRows]);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  );

  const hasActiveFilters =
    Boolean(search) ||
    officeFilter !== "all" ||
    technicianFilter !== "all" ||
    frequencyFilter !== "all";

  function resetFilters() {
    setSearch("");
    setOfficeFilter("all");
    setTechnicianFilter("all");
    setFrequencyFilter("all");
  }

  const openDetail = useCallback((row) => {
    if (!row?.id) return;
    setSelectedVehicleId(row.id);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedVehicleId("");
  }, []);

  const selectedRow = useMemo(
    () => vehicleRows.find((row) => row.id === selectedVehicleId) || null,
    [selectedVehicleId, vehicleRows]
  );

  const columns = useMemo(
    () => [
      {
        key: "placa",
        header: "Placa",
        sortable: true,
        render: (_, row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event?.stopPropagation?.();
              openDetail(row);
            }}
            className="-ml-2 h-auto min-h-0 gap-1.5 px-2 py-1.5 font-mono font-semibold tracking-wide"
            title={`Abrir histórico de ${row.placa}`}
          >
            {row.placa}
            <ChevronRight className="size-3.5" strokeWidth={1.8} />
          </Button>
        ),
      },
      {
        key: "vehicleName",
        header: "Veículo",
        sortable: true,
        render: (value, row) => (
          <div className="min-w-40">
            <p className="font-medium text-foreground">{value}</p>
            {row.vehicle?.chassi ? (
              <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
                Chassi {row.vehicle.chassi}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "anoCor",
        header: "Ano / cor",
        sortable: true,
      },
      {
        key: "ultimaOficina",
        header: "Última oficina",
        sortable: true,
        render: (value, row) => (
          <div className="min-w-40">
            <p className="font-medium text-foreground">{value}</p>
            {row.historicalOffices.length > 1 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.historicalOffices.length} oficinas no histórico
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "ultimosTecnicos",
        header: "Técnico(s)",
        sortable: true,
        render: (value, row) => (
          <div className="min-w-44">
            <p className="max-w-52 truncate font-medium text-foreground" title={value}>
              {value}
            </p>
            {row.historicalTechnicians.length > 1 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.historicalTechnicians.length} envolvidos no histórico
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "totalServicos",
        header: "Serviços",
        align: "right",
        sortable: true,
        render: (value) => (
          <span className="font-semibold text-foreground">{safeNumber(value)}</span>
        ),
      },
      {
        key: "valorAcumulado",
        header: "Valor acumulado",
        align: "right",
        sortable: true,
        render: (value) => (
          <span className="whitespace-nowrap font-semibold text-foreground">
            {formatMoney(value)}
          </span>
        ),
      },
      {
        key: "ultimoAtendimento",
        header: "Último atendimento",
        sortable: true,
        render: (value) => (
          <span className="whitespace-nowrap text-foreground">
            {value ? formatDate(value, dateRegion) : "Sem atendimento"}
          </span>
        ),
      },
    ],
    [dateRegion, formatMoney, openDetail]
  );

  const selectedServices = selectedRow?.services || [];
  const selectedTotal = selectedRow?.valorAcumulado || 0;
  const selectedTicket = selectedServices.length ? selectedTotal / selectedServices.length : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Consulte as placas atendidas e acompanhe todo o histórico de cada veículo.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Veículos
          </h1>
        </div>

        <Button
          variant="secondary"
          leftIcon={RefreshCw}
          onClick={() => loadData({ silent: true })}
          disabled={refreshing}
        >
          {refreshing ? "Atualizando" : "Atualizar"}
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Veículos no histórico"
          value={metrics.vehicles}
          caption="Placas cadastradas nesta conta"
          icon={Car}
        />
        <MetricCard
          label="Serviços realizados"
          value={metrics.services}
          caption="Atendimentos vinculados a veículos"
          icon={Wrench}
          tone="success"
        />
        <MetricCard
          label="Veículos recorrentes"
          value={metrics.recurring}
          caption="Com dois ou mais atendimentos"
          icon={Repeat2}
          tone={metrics.recurring ? "warning" : "primary"}
        />
        <MetricCard
          label="Valor acumulado"
          value={formatMoney(metrics.totalValue)}
          caption="Soma dos serviços do histórico"
          icon={CircleDollarSign}
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

          <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar placa, marca, modelo, chassi, oficina ou técnico..."
                className="pl-9"
              />
            </div>

            <Select value={officeFilter} onChange={(event) => setOfficeFilter(event.target.value)}>
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

            <Select
              value={frequencyFilter}
              onChange={(event) => setFrequencyFilter(event.target.value)}
            >
              <option value="all">Qualquer frequência</option>
              <option value="recurrent">Recorrentes</option>
              <option value="single">Apenas 1 serviço</option>
              <option value="none">Sem serviços</option>
            </Select>
          </div>

          {hasActiveFilters ? (
            <Button variant="ghost" leftIcon={X} onClick={resetFilters}>
              Limpar
            </Button>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">{error}</p>
        </section>
      ) : null}

      <section>
        <Table
          data={loading ? [] : pagedRows}
          columns={columns}
          loading={loading}
          sortable
          sort={sort}
          onSortChange={(nextSort) => {
            setSort(nextSort);
            setPage(1);
          }}
          manualSorting
          pagination={false}
          onRowClick={openDetail}
          emptyTitle={hasActiveFilters ? "Nenhum veículo encontrado" : "Nenhum veículo no histórico"}
          emptyDescription={
            hasActiveFilters
              ? "Ajuste os filtros ou limpe a busca para visualizar outros veículos."
              : "Os veículos aparecerão aqui automaticamente quando forem utilizados nos serviços."
          }
        />
      </section>

      {!loading && sortedRows.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-foreground">
                {(page - 1) * pageSize + 1}
              </strong>{" "}
              a{" "}
              <strong className="font-semibold text-foreground">
                {Math.min(page * pageSize, sortedRows.length)}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-foreground">
                {sortedRows.length}
              </strong>
            </span>

            <div className="flex items-center gap-2">
              <span>Por pagina</span>
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
              aria-label="Pagina anterior"
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
              aria-label="Proxima pagina"
            >
              <ChevronRight className="size-4" strokeWidth={1.8} />
            </Button>
          </div>
        </section>
      ) : null}

      <Drawer
        open={detailOpen}
        onClose={closeDetail}
        title={selectedRow ? `Histórico • ${selectedRow.placa}` : "Histórico do veículo"}
      >
        {selectedRow ? (
          <div className="space-y-6 pb-2">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-foreground">
                  <Car className="size-6" strokeWidth={1.8} />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-foreground">
                      {selectedRow.vehicleName}
                    </h2>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-foreground">
                      {selectedRow.placa}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedRow.totalServicos
                      ? `${selectedRow.totalServicos} atendimento${selectedRow.totalServicos === 1 ? "" : "s"} registrado${selectedRow.totalServicos === 1 ? "" : "s"}.`
                      : "Veículo cadastrado, ainda sem atendimento no histórico."}
                  </p>
                </div>
              </div>

              {selectedRow.ultimoAtendimento ? (
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Último atendimento</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatDate(selectedRow.ultimoAtendimento, dateRegion)}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailMetric label="Serviços" value={selectedRow.totalServicos} icon={History} />
              <DetailMetric label="Total histórico" value={formatMoney(selectedTotal)} icon={Banknote} />
              <DetailMetric label="Ticket médio" value={formatMoney(selectedTicket)} icon={Gauge} />
              <DetailMetric
                label="Oficinas"
                value={selectedRow.historicalOffices.length}
                icon={Building2}
              />
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-foreground">Dados do veículo</h3>
                <p className="text-sm text-muted-foreground">
                  Informações cadastrais e resumo dos envolvidos no histórico.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem icon={Hash} label="Placa" value={selectedRow.placa} />
                <InfoItem icon={Car} label="Marca" value={selectedRow.vehicle.marca} />
                <InfoItem icon={Car} label="Modelo" value={selectedRow.vehicle.modelo} />
                <InfoItem icon={CalendarDays} label="Ano" value={selectedRow.vehicle.ano} />
                <InfoItem icon={Palette} label="Cor" value={selectedRow.vehicle.cor} />
                <InfoItem icon={ScanLine} label="Chassi" value={selectedRow.vehicle.chassi} />
                <InfoItem label="Cadastrado em" value={formatDateTime(selectedRow.vehicle.created_at)} />
                <InfoItem
                  label="Última atualização"
                  value={formatDateTime(selectedRow.vehicle.updated_at)}
                />
                <InfoItem icon={Building2} label="Oficinas no histórico">
                  {selectedRow.historicalOffices.length
                    ? selectedRow.historicalOffices.map((office) => office.nome).join(", ")
                    : "Nenhuma oficina no histórico"}
                </InfoItem>
                <InfoItem icon={Wrench} label="Técnicos envolvidos">
                  {selectedRow.historicalTechnicians.length
                    ? selectedRow.historicalTechnicians
                        .map((technician) => technician.nome)
                        .join(", ")
                    : "Nenhum técnico no histórico"}
                </InfoItem>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="size-3.5" strokeWidth={1.8} />
                  Observações do veículo
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                  {selectedRow.vehicle.observacoes || "Nenhuma observação cadastrada."}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Histórico de serviços</h3>
                  <p className="text-sm text-muted-foreground">
                    Oficina, responsáveis, valores e informações de cada atendimento.
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {selectedServices.length} registro{selectedServices.length === 1 ? "" : "s"}
                </p>
              </div>

              {selectedServices.length ? (
                <div className="space-y-3">
                  {selectedServices.map((service) => {
                    const serviceTechnicians = getServiceTechnicians(service);

                    return (
                      <article
                        key={service.id}
                        className="rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-foreground">
                                <CalendarDays className="size-3.5" strokeWidth={1.8} />
                                {formatDate(service.data_servico, dateRegion)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <Building2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
                                {service.oficina?.nome || "Oficina não informada"}
                              </span>
                            </div>

                            {service.oficina?.cidade ? (
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {[service.oficina.cidade, service.oficina.estado_regiao]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </p>
                            ) : null}
                          </div>

                          <div className="shrink-0 sm:text-right">
                            <p className="text-xs font-medium text-muted-foreground">Valor do serviço</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {formatMoney(service.valor, service.moeda)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-border pt-4">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Wrench className="size-3.5" strokeWidth={1.8} />
                            Técnico(s) responsável(is)
                          </div>

                          {serviceTechnicians.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {serviceTechnicians.map((link) => (
                                <span
                                  key={link.id || `${service.id}-${link.tecnico_id}`}
                                  className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground"
                                >
                                  <strong className="font-semibold">
                                    {link.tecnico?.nome || "Técnico"}
                                  </strong>
                                  <span className="text-muted-foreground">
                                    {" "}• {formatPercent(link.percentual)} • repasse {formatMoney(link.valor_repasse, link.moeda || service.moeda)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Nenhum técnico vinculado a este atendimento.
                            </p>
                          )}
                        </div>

                        {service.descricao || service.observacoes ? (
                          <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2">
                            {service.descricao ? (
                              <div className="rounded-lg bg-background p-3">
                                <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                  {service.descricao}
                                </p>
                              </div>
                            ) : null}

                            {service.observacoes ? (
                              <div className="rounded-lg bg-background p-3">
                                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                                  {service.observacoes}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center">
                  <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-foreground">
                    <History className="size-5" strokeWidth={1.8} />
                  </span>
                  <h4 className="mt-3 text-sm font-semibold text-foreground">
                    Nenhum serviço encontrado para este veículo
                  </h4>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    O cadastro do veículo foi preservado, mas ainda não existe atendimento vinculado a ele.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
