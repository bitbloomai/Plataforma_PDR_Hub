"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRoundCheck,
  Wrench,
  X,
} from "lucide-react";

import { Button, Input, Select } from "@/components/shared";
import { TechnicianDeleteModal } from "@/components/tecnicos/technician-delete-modal";
import { TechnicianFormModal } from "@/components/tecnicos/technician-form-modal";
import {
  Avatar,
  CountryBadge,
  MetricCard,
  StatusBadge,
} from "@/components/tecnicos/technician-ui";
import { createClient } from "@/lib/supabase/client";
import { formatDisplayMoney, moneyFromStorage, withSourceCurrency } from "@/lib/currency";
import { toast } from "@/lib/toast";
import { formatPhone } from "@/lib/formatters";
import {
  TECHNICIAN_SELECT,
  countryMeta,
  fetchMe,
  getPhotoUrl,
  isPaidStatus,
  normalizeCountry,
  normalizeText,
  resolvePhoneCountry,
  sortTechnicians,
} from "@/lib/technicians";

const PAGE_SIZES = [12, 24, 48];

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

function TechnicianCard({
  technician,
  photoUrl,
  officeLinks,
  pendingAmount,
  formatMoney,
  onOpen,
  onPrefetch,
  onEdit,
  onDelete,
}) {
  const phoneCode = resolvePhoneCountry(technician.telefone, technician.telefone_pais);
  const visibleOffices = officeLinks.slice(0, 2);
  const extraOffices = Math.max(0, officeLinks.length - visibleOffices.length);

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={() => onOpen(technician)}
      onMouseEnter={() => onPrefetch(technician)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(technician);
        }
      }}
      className="group relative cursor-pointer rounded-xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/40 focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex items-start gap-3">
        <Avatar technician={technician} photoUrl={photoUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {technician.nome}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge active={technician.ativo} />
                <CountryBadge code={technician.nacionalidade} />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Editar técnico"
                aria-label={`Editar ${technician.nome}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(technician);
                }}
              >
                <Pencil className="size-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Excluir técnico"
                aria-label={`Excluir ${technician.nome}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(technician);
                }}
              >
                <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <Phone className="size-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">
                {technician.telefone
                  ? `${countryMeta(phoneCode).flag} ${formatPhone(
                      technician.telefone,
                      phoneCode
                    )}`
                  : "Telefone não informado"}
              </span>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0" strokeWidth={1.8} />
              <span className="truncate">{technician.email || "E-mail não informado"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Oficinas atuais</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleOffices.length ? (
                <>
                  {visibleOffices.map((link) => (
                    <span
                      key={link.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs text-foreground"
                    >
                      <Building2 className="size-3 shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{link.oficina?.nome || "Oficina"}</span>
                    </span>
                  ))}
                  {extraOffices ? (
                    <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-1 text-xs text-muted-foreground">
                      +{extraOffices}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Sem oficina vinculada</span>
              )}
            </div>
          </div>

          {pendingAmount > 0 ? (
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium text-muted-foreground">A repassar</p>
              <p className="mt-1 text-sm font-semibold text-warning">
                {formatMoney(pendingAmount)}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TechnicianGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex gap-3">
            <div className="size-14 animate-pulse rounded-full bg-surface-2" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-2/3 animate-pulse rounded bg-surface-2" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-surface-2" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-4/5 animate-pulse rounded bg-surface-2" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="mt-4 h-12 animate-pulse rounded-lg bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

export default function TecnicosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);

  const [me, setMe] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [links, setLinks] = useState([]);
  const [repasseMovements, setRepasseMovements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nationalityFilter, setNationalityFilter] = useState("all");
  const [allocationFilter, setAllocationFilter] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const formatMoney = useCallback(
    (value, sourceCurrency) =>
      formatDisplayMoney(value, withSourceCurrency(me?.configuracao, sourceCurrency || me?.configuracao?.moeda)),
    [me?.configuracao]
  );

  const moneyValue = useCallback(
    (value, sourceCurrency) => moneyFromStorage(value, withSourceCurrency(me?.configuracao, sourceCurrency), sourceCurrency),
    [me?.configuracao]
  );

  const linksByTechnician = useMemo(() => {
    const map = new Map();
    links.forEach((link) => {
      if (!map.has(link.tecnico_id)) map.set(link.tecnico_id, []);
      map.get(link.tecnico_id).push(link);
    });

    for (const values of map.values()) {
      values.sort((a, b) =>
        String(a.oficina?.nome || "").localeCompare(String(b.oficina?.nome || ""), "it", {
          sensitivity: "base",
        })
      );
    }

    return map;
  }, [links]);

  const pendingByTechnician = useMemo(() => {
    const map = new Map();
    repasseMovements.forEach((movement) => {
      if (!movement.tecnico_id || isPaidStatus(movement.status)) return;
      map.set(
        movement.tecnico_id,
        (map.get(movement.tecnico_id) || 0) + moneyValue(movement.valor, movement.moeda)
      );
    });
    return map;
  }, [moneyValue, repasseMovements]);

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

        const [techniciansResult, linksResult, movementsResult] = await Promise.all([
          supabase
            .from("tecnicos")
            .select(TECHNICIAN_SELECT)
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
            .order("created_at", { ascending: true })
            .range(0, 4999),
          supabase
            .from("movimentacoes_financeiras")
            .select("id,tecnico_id,valor,moeda,status,origem")
            .eq("conta_id", currentContaId)
            .eq("origem", "repasse_tecnico")
            .not("tecnico_id", "is", null)
            .range(0, 4999),
        ]);

        if (techniciansResult.error) throw techniciansResult.error;
        if (linksResult.error) throw linksResult.error;
        if (movementsResult.error) throw movementsResult.error;

        setMe(meData);
        setTechnicians(techniciansResult.data || []);
        setLinks(linksResult.data || []);
        setRepasseMovements(movementsResult.data || []);
      } catch (loadError) {
        console.error("Técnicos load", loadError);
        const message = loadError?.message || "Não foi possível carregar os técnicos.";
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

  const metrics = useMemo(() => {
    const active = technicians.filter((technician) => technician.ativo).length;
    const allocated = new Set(links.map((link) => link.tecnico_id)).size;
    const pending = repasseMovements
      .filter((movement) => !isPaidStatus(movement.status))
      .reduce((sum, movement) => sum + moneyValue(movement.valor, movement.moeda), 0);

    return {
      total: technicians.length,
      active,
      allocated,
      pending,
    };
  }, [links, moneyValue, repasseMovements, technicians]);

  const filteredTechnicians = useMemo(() => {
    const term = normalizeText(search);

    return technicians.filter((technician) => {
      if (statusFilter === "active" && !technician.ativo) return false;
      if (statusFilter === "inactive" && technician.ativo) return false;
      if (
        nationalityFilter !== "all" &&
        normalizeCountry(technician.nacionalidade, "") !== nationalityFilter
      ) {
        return false;
      }

      const technicianLinks = linksByTechnician.get(technician.id) || [];
      if (allocationFilter === "allocated" && !technicianLinks.length) return false;
      if (allocationFilter === "unallocated" && technicianLinks.length) return false;

      if (!term) return true;

      const officeNames = technicianLinks
        .map((link) => link.oficina?.nome)
        .filter(Boolean)
        .join(" ");

      const haystack = normalizeText(
        [
          technician.nome,
          technician.email,
          technician.telefone,
          technician.documento,
          technician.banco_nome,
          technician.iban,
          officeNames,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(term);
    });
  }, [
    allocationFilter,
    linksByTechnician,
    nationalityFilter,
    search,
    statusFilter,
    technicians,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTechnicians.length / pageSize));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPage(1));
    return () => cancelAnimationFrame(frame);
  }, [search, statusFilter, nationalityFilter, allocationFilter, pageSize]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPage((current) => Math.min(current, totalPages));
    });
    return () => cancelAnimationFrame(frame);
  }, [totalPages]);

  const pagedTechnicians = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTechnicians.slice(start, start + pageSize);
  }, [filteredTechnicians, page, pageSize]);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  );

  const hasActiveFilters =
    Boolean(search) ||
    statusFilter !== "all" ||
    nationalityFilter !== "all" ||
    allocationFilter !== "all";

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setNationalityFilter("all");
    setAllocationFilter("all");
  }

  function openCreate() {
    setEditingTechnician(null);
    setFormKey((current) => current + 1);
    setFormOpen(true);
  }

  function openEdit(technician) {
    setEditingTechnician(technician);
    setFormKey((current) => current + 1);
    setFormOpen(true);
  }

  function openTechnician(technician) {
    router.push(`/panel/tecnicos/${technician.id}`);
  }

  function prefetchTechnician(technician) {
    router.prefetch(`/panel/tecnicos/${technician.id}`);
  }

  function handleSaved(data, { created }) {
    setTechnicians((current) =>
      sortTechnicians(
        created
          ? [...current, data]
          : current.map((technician) => (technician.id === data.id ? data : technician))
      )
    );
    setFormOpen(false);
  }

  function handleDeleted(target) {
    setTechnicians((current) => current.filter((technician) => technician.id !== target.id));
    setLinks((current) => current.filter((link) => link.tecnico_id !== target.id));
    setRepasseMovements((current) =>
      current.filter((movement) => movement.tecnico_id !== target.id)
    );
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Cadastre os profissionais, organize as oficinas e faça o fechamento dos repasses.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Técnicos
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
            Novo técnico
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Técnicos cadastrados"
          value={metrics.total}
          caption="Total desta conta"
          icon={Wrench}
        />
        <MetricCard
          label="Técnicos ativos"
          value={metrics.active}
          caption="Disponíveis para novos serviços"
          icon={BadgeCheck}
          tone="success"
        />
        <MetricCard
          label="Com oficina atual"
          value={metrics.allocated}
          caption="Profissionais alocados agora"
          icon={UserRoundCheck}
        />
        <MetricCard
          label="Repasses pendentes"
          value={formatMoney(metrics.pending)}
          caption="Somatório ainda não pago"
          icon={CircleDollarSign}
          tone={metrics.pending > 0 ? "warning" : "primary"}
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
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar técnico, contato, documento ou oficina..."
                className="pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="active">Somente ativos</option>
              <option value="inactive">Somente inativos</option>
            </Select>

            <Select
              value={nationalityFilter}
              onChange={(event) => setNationalityFilter(event.target.value)}
            >
              <option value="all">Todas as nacionalidades</option>
              <option value="BR">🇧🇷 Brasil</option>
              <option value="IT">🇮🇹 Itália</option>
            </Select>

            <Select
              value={allocationFilter}
              onChange={(event) => setAllocationFilter(event.target.value)}
            >
              <option value="all">Todas as alocações</option>
              <option value="allocated">Com oficina vinculada</option>
              <option value="unallocated">Sem oficina vinculada</option>
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

      {loading ? (
        <TechnicianGridSkeleton />
      ) : pagedTechnicians.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pagedTechnicians.map((technician) => (
            <TechnicianCard
              key={technician.id}
              technician={technician}
              photoUrl={getPhotoUrl(supabase, technician.foto_url)}
              officeLinks={linksByTechnician.get(technician.id) || []}
              pendingAmount={pendingByTechnician.get(technician.id) || 0}
              formatMoney={formatMoney}
              onOpen={openTechnician}
              onPrefetch={prefetchTechnician}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-foreground">
            <Wrench className="size-6" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {hasActiveFilters
              ? "Nenhum técnico encontrado"
              : "Cadastre o primeiro técnico"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Ajuste os filtros ou limpe a busca para visualizar outros profissionais."
              : "Adicione os profissionais que executam os serviços e depois vincule as oficinas em que estão trabalhando."}
          </p>
          {!hasActiveFilters ? (
            <div className="mt-5">
              <Button leftIcon={Plus} onClick={openCreate}>
                Criar técnico
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {!loading && filteredTechnicians.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-foreground">
                {(page - 1) * pageSize + 1}
              </strong>{" "}
              a{" "}
              <strong className="font-semibold text-foreground">
                {Math.min(page * pageSize, filteredTechnicians.length)}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-foreground">
                {filteredTechnicians.length}
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
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page === totalPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" strokeWidth={1.8} />
            </Button>
          </div>
        </section>
      ) : null}

      <TechnicianFormModal
        key={formKey}
        open={formOpen}
        technician={editingTechnician}
        me={me}
        supabase={supabase}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <TechnicianDeleteModal
        target={deleteTarget}
        me={me}
        supabase={supabase}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
