"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  FileText,
  Filter,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  UserRoundCheck,
  Wrench,
  X,
} from "lucide-react";

import {
  Button,
  Drawer,
  Form,
  FormField,
  FormGrid,
  FormSection,
  Input,
  Modal,
  Select,
  Switch,
  Textarea,
} from "@/components/shared";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { formatDate, formatPhone, formatPostalCode } from "@/lib/formatters";
import { maskPhone, maskPostalCode } from "@/lib/inputMasks";

const PAGE_SIZES = [12, 24, 48];

const EMPTY_FORM = {
  nome: "",
  responsavel: "",
  email: "",
  telefone: "",
  documento: "",
  pec: "",
  codice_destinatario: "",
  endereco: "",
  cidade: "",
  estado_regiao: "",
  cep: "",
  pais: "Italia",
  observacoes: "",
  ativo: true,
};

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
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

function countryCode(value) {
  const normalized = normalizeText(value);
  return normalized.includes("brasil") || normalized === "br" ? "BR" : "IT";
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

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-success/10 text-success"
          : "bg-surface-2 text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`}
      />
      {active ? "Ativa" : "Inativa"}
    </span>
  );
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

function Avatar({ technician, photoUrl, size = "md" }) {
  const sizeClass = size === "sm" ? "size-8 text-[10px]" : "size-12 text-xs";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-foreground ${sizeClass}`}
      title={technician?.nome || "Martelinho"}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={technician?.nome || "Martelinho"}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(technician?.nome)
      )}
    </span>
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
        {children || value || "Não informado"}
      </div>
    </div>
  );
}

function OfficeCard({ office, links, photoMap, onOpen, onEdit, onDelete }) {
  const address = [office.endereco, office.cidade, office.estado_regiao]
    .filter(Boolean)
    .join(", ");
  const visibleLinks = links.slice(0, 4);
  const extra = Math.max(0, links.length - visibleLinks.length);
  const code = countryCode(office.pais);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(office)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(office);
        }
      }}
      className="group relative cursor-pointer rounded-xl border border-border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/40 focus-visible:ring-2 focus-visible:ring-primary/30 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-foreground transition group-hover:scale-105">
          <Building2 className="size-5" strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {office.nome}
              </h3>
              <div className="mt-1.5">
                <StatusBadge active={office.ativo} />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Editar oficina"
                aria-label={`Editar ${office.nome}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(office);
                }}
              >
                <Pencil className="size-4" strokeWidth={1.8} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Excluir oficina"
                aria-label={`Excluir ${office.nome}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(office);
                }}
              >
                <Trash2 className="size-4 text-danger" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <span className="line-clamp-2">{address || "Endereço não informado"}</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2">
                <Phone className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">
                  {office.telefone
                    ? formatPhone(office.telefone, code)
                    : "Telefone não informado"}
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <CircleUserRound className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{office.responsavel || "Sem responsável"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Martelinhos trabalhando aqui
          </p>
          <div className="mt-2 flex items-center">
            {visibleLinks.length ? (
              <>
                {visibleLinks.map((link, index) => (
                  <span
                    key={link.id}
                    className={index ? "-ml-2" : ""}
                    style={{ zIndex: visibleLinks.length - index }}
                  >
                    <Avatar
                      technician={link.tecnico}
                      photoUrl={photoMap.get(link.tecnico_id)}
                      size="sm"
                    />
                  </span>
                ))}
                {extra > 0 ? (
                  <span className="-ml-2 grid size-8 place-items-center rounded-full border border-border bg-surface-2 text-[10px] font-semibold text-muted-foreground">
                    +{extra}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Nenhum vinculado</span>
            )}
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition group-hover:text-foreground">
          Ver detalhes
          <ChevronRight className="size-3.5" strokeWidth={1.8} />
        </span>
      </div>
    </article>
  );
}

function OfficeListSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="h-56 animate-pulse rounded-xl border border-border bg-surface"
        >
          <div className="space-y-4 p-5">
            <div className="flex gap-3">
              <div className="size-11 rounded-lg bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 rounded bg-surface-2" />
                <div className="h-5 w-20 rounded-full bg-surface-2" />
              </div>
            </div>
            <div className="h-4 w-full rounded bg-surface-2" />
            <div className="h-4 w-4/5 rounded bg-surface-2" />
            <div className="h-10 w-full rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OficinasPage() {
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);
  const detailCacheRef = useRef(new Map());

  const [me, setMe] = useState(null);
  const [offices, setOffices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [links, setLinks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  const [selectedOffice, setSelectedOffice] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [officeDetail, setOfficeDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [techSearch, setTechSearch] = useState("");
  const [mutatingTechId, setMutatingTechId] = useState("");

  const contaId = me?.usuario?.conta_id || "";
  const usuarioId = me?.usuario?.id || "";

  const closeForm = useCallback(() => {
    if (saving) return;

    setFormOpen(false);
    setEditingOffice(null);
    setFormErrors({});
  }, [saving]);

  const photoMap = useMemo(() => {
    const map = new Map();
    technicians.forEach((technician) => {
      map.set(technician.id, getPhotoUrl(supabase, technician.foto_url));
    });
    return map;
  }, [supabase, technicians]);

  const linksByOffice = useMemo(() => {
    const map = new Map();
    links.forEach((link) => {
      if (!map.has(link.oficina_id)) map.set(link.oficina_id, []);
      map.get(link.oficina_id).push(link);
    });
    return map;
  }, [links]);

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

        const [officesResult, techniciansResult, linksResult] = await Promise.all([
          supabase
            .from("oficinas")
            .select(
              "id,conta_id,nome,responsavel,email,telefone,documento,pec,codice_destinatario,endereco,cidade,estado_regiao,cep,pais,observacoes,ativo,created_by,updated_by,created_at,updated_at"
            )
            .eq("conta_id", currentContaId)
            .order("ativo", { ascending: false })
            .order("nome", { ascending: true })
            .range(0, 4999),
          supabase
            .from("tecnicos")
            .select("id,conta_id,nome,email,telefone,documento,foto_url,ativo")
            .eq("conta_id", currentContaId)
            .order("ativo", { ascending: false })
            .order("nome", { ascending: true })
            .range(0, 4999),
          supabase
            .from("oficinas_martelinhos")
            .select(
              "id,conta_id,oficina_id,tecnico_id,created_at,tecnico:tecnicos(id,nome,email,telefone,foto_url,ativo)"
            )
            .eq("conta_id", currentContaId)
            .order("created_at", { ascending: true })
            .range(0, 4999),
        ]);

        if (officesResult.error) throw officesResult.error;
        if (techniciansResult.error) throw techniciansResult.error;
        if (linksResult.error) throw linksResult.error;

        setMe(meData);
        setOffices(officesResult.data || []);
        setTechnicians(techniciansResult.data || []);
        setLinks(linksResult.data || []);
      } catch (loadError) {
        console.error("Oficinas load", loadError);
        const message = loadError?.message || "Não foi possível carregar as oficinas.";
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

  const cities = useMemo(() => {
    return [...new Set(offices.map((office) => office.cidade).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [offices]);

  const metrics = useMemo(() => {
    const active = offices.filter((office) => office.ativo).length;
    const inactive = offices.length - active;
    const linkedTechnicians = new Set(links.map((link) => link.tecnico_id)).size;

    return {
      total: offices.length,
      active,
      inactive,
      linkedTechnicians,
    };
  }, [links, offices]);

  const filteredOffices = useMemo(() => {
    const term = normalizeText(search);

    return offices.filter((office) => {
      if (statusFilter === "active" && !office.ativo) return false;
      if (statusFilter === "inactive" && office.ativo) return false;
      if (cityFilter !== "all" && office.cidade !== cityFilter) return false;
      if (!term) return true;

      const linkedNames = (linksByOffice.get(office.id) || [])
        .map((link) => link.tecnico?.nome)
        .filter(Boolean)
        .join(" ");

      const haystack = normalizeText(
        [
          office.nome,
          office.responsavel,
          office.email,
          office.telefone,
          office.documento,
          office.pec,
          office.codice_destinatario,
          office.endereco,
          office.cidade,
          office.estado_regiao,
          office.cep,
          office.pais,
          linkedNames,
        ]
          .filter(Boolean)
          .join(" ")
      );

      return haystack.includes(term);
    });
  }, [cityFilter, linksByOffice, offices, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOffices.length / pageSize));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPage(1));
    return () => cancelAnimationFrame(frame);
  }, [search, statusFilter, cityFilter, pageSize]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPage((current) => Math.min(current, totalPages));
    });
    return () => cancelAnimationFrame(frame);
  }, [totalPages]);

  const pagedOffices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOffices.slice(start, start + pageSize);
  }, [filteredOffices, page, pageSize]);

  const paginationItems = useMemo(
    () => buildPagination(page, totalPages),
    [page, totalPages]
  );

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setCityFilter("all");
  }

  function openCreate() {
    setEditingOffice(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(office) {
    const code = countryCode(office.pais);

    setEditingOffice(office);
    setForm({
      nome: office.nome || "",
      responsavel: office.responsavel || "",
      email: office.email || "",
      telefone: office.telefone ? maskPhone(office.telefone, code) : "",
      documento: office.documento || "",
      pec: office.pec || "",
      codice_destinatario: office.codice_destinatario || "",
      endereco: office.endereco || "",
      cidade: office.cidade || "",
      estado_regiao: office.estado_regiao || "",
      cep: office.cep ? maskPostalCode(office.cep, code) : "",
      pais: office.pais || "Italia",
      observacoes: office.observacoes || "",
      ativo: office.ativo !== false,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome da oficina.";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    if (form.pec && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.pec.trim())) {
      nextErrors.pec = "Informe uma PEC válida.";
    }

    if (form.codice_destinatario && form.codice_destinatario.trim().length > 7) {
      nextErrors.codice_destinatario = "O Codice Destinatario possui até 7 caracteres.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function logAudit({ action, officeId, description, before = null, after = null }) {
    if (!contaId) return;

    try {
      await supabase.from("auditoria").insert({
        conta_id: contaId,
        usuario_id: usuarioId || null,
        entidade: "oficinas",
        acao: action,
        registro_id: officeId || null,
        descricao: description,
        dados_anteriores: before,
        dados_novos: after,
      });
    } catch (auditError) {
      console.warn("Auditoria de oficina não registrada", auditError);
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

    const payload = {
      nome: form.nome.trim(),
      responsavel: cleanText(form.responsavel),
      email: cleanText(form.email)?.toLowerCase() || null,
      telefone: cleanDigits(form.telefone),
      documento: cleanText(form.documento)?.toUpperCase() || null,
      pec: cleanText(form.pec)?.toLowerCase() || null,
      codice_destinatario:
        cleanText(form.codice_destinatario)?.toUpperCase() || null,
      endereco: cleanText(form.endereco),
      cidade: cleanText(form.cidade),
      estado_regiao: cleanText(form.estado_regiao),
      cep: cleanDigits(form.cep),
      pais: cleanText(form.pais),
      observacoes: cleanText(form.observacoes),
      ativo: Boolean(form.ativo),
      updated_by: currentUsuarioId || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingOffice) {
        const before = { ...editingOffice };
        const { data, error: updateError } = await supabase
          .from("oficinas")
          .update(payload)
          .eq("id", editingOffice.id)
          .eq("conta_id", currentContaId)
          .select(
            "id,conta_id,nome,responsavel,email,telefone,documento,pec,codice_destinatario,endereco,cidade,estado_regiao,cep,pais,observacoes,ativo,created_by,updated_by,created_at,updated_at"
          )
          .single();

        if (updateError) throw updateError;

        setOffices((current) =>
          current.map((office) => (office.id === data.id ? data : office))
        );

        if (selectedOffice?.id === data.id) setSelectedOffice(data);

        await logAudit({
          action: "atualizar",
          officeId: data.id,
          description: `Oficina ${data.nome} atualizada.`,
          before,
          after: data,
        });

        toast.success("Oficina atualizada", "As alterações foram salvas com sucesso.");
      } else {
        const { data, error: insertError } = await supabase
          .from("oficinas")
          .insert({
            ...payload,
            conta_id: currentContaId,
            created_by: currentUsuarioId || null,
          })
          .select(
            "id,conta_id,nome,responsavel,email,telefone,documento,pec,codice_destinatario,endereco,cidade,estado_regiao,cep,pais,observacoes,ativo,created_by,updated_by,created_at,updated_at"
          )
          .single();

        if (insertError) throw insertError;

        setOffices((current) =>
          [...current, data].sort((a, b) => {
            if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
            return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" });
          })
        );

        await logAudit({
          action: "criar",
          officeId: data.id,
          description: `Oficina ${data.nome} criada.`,
          after: data,
        });

        toast.success("Oficina criada", "A nova oficina já está disponível na operação.");
      }

      setFormOpen(false);
      setEditingOffice(null);
      setForm(EMPTY_FORM);
      setFormErrors({});
    } catch (saveError) {
      console.error("Salvar oficina", saveError);
      toast.error(
        "Não foi possível salvar",
        saveError?.message || "Verifique os dados e tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  const loadOfficeDetail = useCallback(
    async (officeId, { force = false } = {}) => {
      if (!officeId || !contaId) return;

      const cached = detailCacheRef.current.get(officeId);
      if (!force && cached) {
        setOfficeDetail(cached);
        return;
      }

      setDetailLoading(true);

      try {
        const [servicesResult, movementsResult] = await Promise.all([
          supabase
            .from("servicos")
            .select(
              `
                id,
                veiculo_id,
                data_servico,
                valor,
                descricao,
                created_at,
                veiculo:veiculos(id,placa,marca,modelo,ano,cor),
                servicos_tecnicos(tecnico_id)
              `
            )
            .eq("conta_id", contaId)
            .eq("oficina_id", officeId)
            .order("data_servico", { ascending: false })
            .order("created_at", { ascending: false })
            .range(0, 4999),
          supabase
            .from("movimentacoes_financeiras")
            .select("id,valor,tipo,status,data_vencimento")
            .eq("conta_id", contaId)
            .eq("oficina_id", officeId)
            .eq("tipo", "receita")
            .range(0, 4999),
        ]);

        if (servicesResult.error) throw servicesResult.error;
        if (movementsResult.error) throw movementsResult.error;

        const services = servicesResult.data || [];
        const movements = movementsResult.data || [];
        const revenue = services.reduce((sum, service) => sum + safeNumber(service.valor), 0);
        const pending = movements
          .filter(
            (movement) =>
              !["pago", "recebido", "paid"].includes(
                String(movement.status || "").toLowerCase()
              )
          )
          .reduce((sum, movement) => sum + safeNumber(movement.valor), 0);

        const detail = {
          totalServices: services.length,
          revenue,
          averageTicket: services.length ? revenue / services.length : 0,
          pending,
          vehicles: new Set(services.map((service) => service.veiculo_id).filter(Boolean)).size,
          historicalTechnicians: new Set(
            services.flatMap((service) =>
              (service.servicos_tecnicos || []).map((item) => item.tecnico_id)
            )
          ).size,
          recentServices: services.slice(0, 6),
        };

        detailCacheRef.current.set(officeId, detail);
        setOfficeDetail(detail);
      } catch (detailError) {
        console.error("Detalhe oficina", detailError);
        setOfficeDetail(null);
        toast.error(
          "Resumo indisponível",
          "Os dados cadastrais abriram normalmente, mas o resumo operacional não pôde ser carregado."
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [contaId, supabase]
  );

  function openDetail(office) {
    setSelectedOffice(office);
    setOfficeDetail(null);
    setTechSearch("");
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!detailOpen || !selectedOffice?.id || !contaId) return;
    loadOfficeDetail(selectedOffice.id);
  }, [contaId, detailOpen, loadOfficeDetail, selectedOffice?.id]);

  async function toggleTechnician(technician) {
    if (!selectedOffice || !contaId || mutatingTechId) return;

    const officeLinks = linksByOffice.get(selectedOffice.id) || [];
    const existing = officeLinks.find((link) => link.tecnico_id === technician.id);
    setMutatingTechId(technician.id);

    try {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("oficinas_martelinhos")
          .delete()
          .eq("id", existing.id)
          .eq("conta_id", contaId);

        if (deleteError) throw deleteError;

        setLinks((current) => current.filter((link) => link.id !== existing.id));

        await logAudit({
          action: "desvincular_martelinho",
          officeId: selectedOffice.id,
          description: `${technician.nome} removido da oficina ${selectedOffice.nome}.`,
          before: {
            oficina_id: selectedOffice.id,
            tecnico_id: technician.id,
          },
        });

        toast.success("Martelinho removido", `${technician.nome} não está mais vinculado à oficina.`);
      } else {
        const { data, error: insertError } = await supabase
          .from("oficinas_martelinhos")
          .insert({
            conta_id: contaId,
            oficina_id: selectedOffice.id,
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
            tecnico: {
              id: technician.id,
              nome: technician.nome,
              email: technician.email,
              telefone: technician.telefone,
              foto_url: technician.foto_url,
              ativo: technician.ativo,
            },
          },
        ]);

        await logAudit({
          action: "vincular_martelinho",
          officeId: selectedOffice.id,
          description: `${technician.nome} vinculado à oficina ${selectedOffice.nome}.`,
          after: {
            oficina_id: selectedOffice.id,
            tecnico_id: technician.id,
          },
        });

        toast.success("Martelinho vinculado", `${technician.nome} agora aparece nesta oficina.`);
      }
    } catch (relationError) {
      console.error("Vínculo oficina/martelinho", relationError);
      toast.error(
        "Não foi possível alterar o vínculo",
        relationError?.message || "Tente novamente."
      );
    } finally {
      setMutatingTechId("");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !contaId) return;
    setDeleting(true);

    try {
      const { count, error: countError } = await supabase
        .from("servicos")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", contaId)
        .eq("oficina_id", deleteTarget.id);

      if (countError) throw countError;

      if ((count || 0) > 0) {
        toast.warning(
          "Oficina possui histórico",
          "Ela já possui serviços cadastrados. Para preservar o histórico, edite a oficina e marque como inativa."
        );
        setDeleteTarget(null);
        return;
      }

      const before = { ...deleteTarget };
      const { error: deleteError } = await supabase
        .from("oficinas")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("conta_id", contaId);

      if (deleteError) throw deleteError;

      setOffices((current) => current.filter((office) => office.id !== deleteTarget.id));
      setLinks((current) => current.filter((link) => link.oficina_id !== deleteTarget.id));
      detailCacheRef.current.delete(deleteTarget.id);

      if (selectedOffice?.id === deleteTarget.id) {
        setDetailOpen(false);
        setSelectedOffice(null);
      }

      await logAudit({
        action: "excluir",
        officeId: deleteTarget.id,
        description: `Oficina ${deleteTarget.nome} excluída.`,
        before,
      });

      toast.success("Oficina excluída", "O cadastro foi removido com sucesso.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("Excluir oficina", deleteError);
      toast.error(
        "Não foi possível excluir",
        deleteError?.message || "Tente novamente."
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedLinks = selectedOffice ? linksByOffice.get(selectedOffice.id) || [] : [];
  const selectedLinkIds = useMemo(
    () => new Set(selectedLinks.map((link) => link.tecnico_id)),
    [selectedLinks]
  );

  const pickerTechnicians = useMemo(() => {
    const term = normalizeText(techSearch);

    return technicians
      .filter((technician) => technician.ativo || selectedLinkIds.has(technician.id))
      .filter((technician) => {
        if (!term) return true;
        return normalizeText(
          [technician.nome, technician.email, technician.telefone, technician.documento]
            .filter(Boolean)
            .join(" ")
        ).includes(term);
      })
      .sort((a, b) => {
        const aSelected = selectedLinkIds.has(a.id);
        const bSelected = selectedLinkIds.has(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" });
      });
  }, [selectedLinkIds, techSearch, technicians]);

  const selectedCode = countryCode(selectedOffice?.pais);
  const hasActiveFilters = search || statusFilter !== "all" || cityFilter !== "all";

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Cadastre parceiros e organize onde cada martelinho está trabalhando.
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Oficinas
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
            Nova oficina
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Oficinas cadastradas"
          value={metrics.total}
          caption="Total desta conta"
          icon={Building2}
        />
        <MetricCard
          label="Oficinas ativas"
          value={metrics.active}
          caption="Disponíveis para a operação"
          icon={BadgeCheck}
          tone="success"
        />
        <MetricCard
          label="Oficinas inativas"
          value={metrics.inactive}
          caption="Mantidas apenas no histórico"
          icon={ReceiptText}
          tone={metrics.inactive ? "warning" : "primary"}
        />
        <MetricCard
          label="Martelinhos vinculados"
          value={metrics.linkedTechnicians}
          caption="Profissionais alocados em oficinas"
          icon={UserRoundCheck}
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

          <div className="grid flex-1 gap-2 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.8}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar oficina, cidade, contato ou martelinho..."
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos os status</option>
              <option value="active">Somente ativas</option>
              <option value="inactive">Somente inativas</option>
            </Select>

            <Select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
              <option value="all">Todas as cidades</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
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
        <OfficeListSkeleton />
      ) : pagedOffices.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {pagedOffices.map((office) => (
            <OfficeCard
              key={office.id}
              office={office}
              links={linksByOffice.get(office.id) || []}
              photoMap={photoMap}
              onOpen={openDetail}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-foreground">
            <Building2 className="size-6" strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {hasActiveFilters ? "Nenhuma oficina encontrada" : "Sua primeira oficina começa aqui"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Ajuste os filtros ou limpe a busca para visualizar outros cadastros."
              : "Cadastre a primeira oficina parceira e depois escolha os martelinhos que estão trabalhando nela."}
          </p>
          {!hasActiveFilters ? (
            <div className="mt-5">
              <Button leftIcon={Plus} onClick={openCreate}>
                Criar oficina
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {!loading && filteredOffices.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-foreground">
                {(page - 1) * pageSize + 1}
              </strong>{" "}
              a{" "}
              <strong className="font-semibold text-foreground">
                {Math.min(page * pageSize, filteredOffices.length)}
              </strong>{" "}
              de{" "}
              <strong className="font-semibold text-foreground">
                {filteredOffices.length}
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

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingOffice ? "Editar oficina" : "Nova oficina"}
        description="Dados cadastrais e fiscais da oficina parceira."
        size="xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeForm}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="office-form"
              loading={saving}
              leftIcon={editingOffice ? Pencil : Plus}
            >
              {editingOffice ? "Salvar alterações" : "Criar oficina"}
            </Button>
          </>
        }
      >
        <Form id="office-form" onSubmit={handleSave}>
          <FormSection
            title="Dados principais"
            description="Identificação e contato da oficina."
          >
            <FormGrid>
              <FormField label="Nome da oficina" required error={formErrors.nome}>
                <Input
                  value={form.nome}
                  onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                  placeholder="Ex.: Carrozzeria Milano Centro"
                />
              </FormField>

              <FormField label="Responsável">
                <Input
                  value={form.responsavel}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, responsavel: event.target.value }))
                  }
                  placeholder="Nome do contato principal"
                />
              </FormField>

              <FormField label="Telefone">
                <Input
                  type="tel"
                  value={form.telefone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      telefone: maskPhone(event.target.value, countryCode(current.pais)),
                    }))
                  }
                  placeholder="+39 ..."
                />
              </FormField>

              <FormField label="E-mail" error={formErrors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="contato@oficina.it"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Dados fiscais italianos"
            description="Úteis para identificação da empresa e faturação eletrônica."
          >
            <FormGrid>
              <FormField label="Partita IVA / Codice Fiscale">
                <Input
                  value={form.documento}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documento: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="P.IVA ou Codice Fiscale"
                />
              </FormField>

              <FormField label="PEC" error={formErrors.pec}>
                <Input
                  type="email"
                  value={form.pec}
                  onChange={(event) => setForm((current) => ({ ...current, pec: event.target.value }))}
                  placeholder="oficina@pec.it"
                />
              </FormField>

              <FormField
                label="Codice Destinatario (SDI)"
                error={formErrors.codice_destinatario}
              >
                <Input
                  value={form.codice_destinatario}
                  maxLength={7}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      codice_destinatario: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="7 caracteres"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Endereço" description="Localização operacional da oficina.">
            <FormGrid>
              <FormField label="Endereço">
                <Input
                  value={form.endereco}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endereco: event.target.value }))
                  }
                  placeholder="Via, número e complemento"
                />
              </FormField>

              <FormField label="Cidade">
                <Input
                  value={form.cidade}
                  onChange={(event) => setForm((current) => ({ ...current, cidade: event.target.value }))}
                  placeholder="Milano"
                />
              </FormField>

              <FormField label="Região / Província">
                <Input
                  value={form.estado_regiao}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, estado_regiao: event.target.value }))
                  }
                  placeholder="Lombardia / MI"
                />
              </FormField>

              <FormField label="CAP / CEP">
                <Input
                  value={form.cep}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cep: maskPostalCode(event.target.value, countryCode(current.pais)),
                    }))
                  }
                  placeholder="20100"
                />
              </FormField>

              <FormField label="País">
                <Input
                  value={form.pais}
                  onChange={(event) => setForm((current) => ({ ...current, pais: event.target.value }))}
                  placeholder="Italia"
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection title="Operação" description="Status e observações internas.">
            <FormGrid>
              <FormField label="Oficina ativa">
                <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, ativo: checked }))
                    }
                    id="oficina-ativa"
                  />

                  <label
                    htmlFor="oficina-ativa"
                    className="cursor-pointer text-sm text-muted-foreground"
                  >
                    {form.ativo
                      ? "Disponível para novos serviços"
                      : "Mantida apenas para histórico"}
                  </label>
                </div>
              </FormField>
            </FormGrid>

            <FormField label="Observações">
              <Textarea
                value={form.observacoes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, observacoes: event.target.value }))
                }
                rows={4}
                placeholder="Informações úteis sobre acesso, horários, contato, regras da oficina..."
              />
            </FormField>
          </FormSection>
        </Form>
      </Modal>

      <Drawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedOffice(null);
          setOfficeDetail(null);
          setTechSearch("");
        }}
        title={selectedOffice?.nome || "Detalhes da oficina"}
        footer={
          selectedOffice ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="danger"
                leftIcon={Trash2}
                onClick={() => setDeleteTarget(selectedOffice)}
              >
                Excluir
              </Button>
              <Button variant="outline" leftIcon={Pencil} onClick={() => openEdit(selectedOffice)}>
                Editar oficina
              </Button>
            </div>
          ) : null
        }
      >
        {selectedOffice ? (
          <div className="space-y-6 pb-2">
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-foreground">
                  <Building2 className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="font-semibold text-foreground">{selectedOffice.nome}</h2>
                  <p className="text-sm text-muted-foreground">
                    {[selectedOffice.cidade, selectedOffice.pais].filter(Boolean).join(", ") ||
                      "Localização não informada"}
                  </p>
                </div>
              </div>
              <StatusBadge active={selectedOffice.ativo} />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Resumo operacional</h3>
                  <p className="text-sm text-muted-foreground">
                    Indicadores acumulados desta oficina.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => loadOfficeDetail(selectedOffice.id, { force: true })}
                  disabled={detailLoading}
                  aria-label="Atualizar resumo"
                  title="Atualizar resumo"
                >
                  <RefreshCw
                    className={`size-4 ${detailLoading ? "animate-spin" : ""}`}
                    strokeWidth={1.8}
                  />
                </Button>
              </div>

              {detailLoading && !officeDetail ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-lg border border-border bg-surface-2"
                    />
                  ))}
                </div>
              ) : officeDetail ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoItem label="Serviços" value={officeDetail.totalServices} />
                  <InfoItem label="Faturamento" value={formatMoney(officeDetail.revenue)} />
                  <InfoItem label="Ticket médio" value={formatMoney(officeDetail.averageTicket)} />
                  <InfoItem label="A receber" value={formatMoney(officeDetail.pending)} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                  Resumo operacional indisponível.
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-lg bg-primary/10">
                      <Wrench className="size-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Martelinhos trabalhando na oficina
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Clique em uma pessoa para vincular ou remover. Os selecionados aparecem primeiro.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative w-full sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={1.8}
                  />
                  <Input
                    value={techSearch}
                    onChange={(event) => setTechSearch(event.target.value)}
                    placeholder="Buscar martelinho..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {pickerTechnicians.map((technician) => {
                  const linked = selectedLinkIds.has(technician.id);
                  const busy = mutatingTechId === technician.id;

                  return (
                    <button
                      key={technician.id}
                      type="button"
                      aria-pressed={linked}
                      disabled={Boolean(mutatingTechId)}
                      onClick={() => toggleTechnician(technician)}
                      className={`group relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-70 ${
                        linked
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-background hover:-translate-y-1 hover:border-border-strong hover:bg-surface-2"
                      }`}
                    >
                      <span
                        className={`relative rounded-full transition duration-200 ${
                          linked ? "scale-105 ring-2 ring-primary ring-offset-2 ring-offset-surface" : "group-hover:scale-105"
                        }`}
                      >
                        <Avatar
                          technician={technician}
                          photoUrl={photoMap.get(technician.id)}
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border border-surface text-[10px] ${
                            linked
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-3 text-muted-foreground"
                          }`}
                        >
                          {busy ? (
                            <RefreshCw className="size-3 animate-spin" strokeWidth={2} />
                          ) : linked ? (
                            <Check className="size-3" strokeWidth={2.5} />
                          ) : (
                            <Plus className="size-3" strokeWidth={2.2} />
                          )}
                        </span>
                      </span>

                      <span className="line-clamp-2 text-xs font-medium text-foreground">
                        {technician.nome}
                      </span>
                    </button>
                  );
                })}
              </div>

              {!pickerTechnicians.length ? (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
                  Nenhum martelinho encontrado para esta busca.
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-foreground">Dados da oficina</h3>
                <p className="text-sm text-muted-foreground">Informações completas do cadastro.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem icon={CircleUserRound} label="Responsável" value={selectedOffice.responsavel} />
                <InfoItem icon={Phone} label="Telefone">
                  {selectedOffice.telefone
                    ? formatPhone(selectedOffice.telefone, selectedCode)
                    : "Não informado"}
                </InfoItem>
                <InfoItem icon={Mail} label="E-mail" value={selectedOffice.email} />
                <InfoItem icon={FileText} label="Partita IVA / Codice Fiscale" value={selectedOffice.documento} />
                <InfoItem icon={Mail} label="PEC" value={selectedOffice.pec} />
                <InfoItem icon={ReceiptText} label="Codice Destinatario" value={selectedOffice.codice_destinatario} />
                <InfoItem icon={MapPin} label="Endereço" value={selectedOffice.endereco} />
                <InfoItem icon={MapPin} label="Cidade" value={selectedOffice.cidade} />
                <InfoItem icon={MapPin} label="Região / Província" value={selectedOffice.estado_regiao} />
                <InfoItem icon={MapPin} label="CAP / CEP">
                  {selectedOffice.cep
                    ? formatPostalCode(selectedOffice.cep, selectedCode)
                    : "Não informado"}
                </InfoItem>
                <InfoItem icon={MapPin} label="País" value={selectedOffice.pais} />
                <InfoItem label="Criada em" value={formatDateTime(selectedOffice.created_at)} />
                <InfoItem label="Última atualização" value={formatDateTime(selectedOffice.updated_at)} />
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                  {selectedOffice.observacoes || "Nenhuma observação cadastrada."}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Últimos serviços</h3>
                  <p className="text-sm text-muted-foreground">
                    Uma leitura rápida do histórico recente da oficina.
                  </p>
                </div>
                {officeDetail ? (
                  <div className="hidden gap-4 text-right text-xs text-muted-foreground sm:flex">
                    <span>
                      <strong className="block text-sm font-semibold text-foreground">
                        {officeDetail.vehicles}
                      </strong>
                      veículos
                    </span>
                    <span>
                      <strong className="block text-sm font-semibold text-foreground">
                        {officeDetail.historicalTechnicians}
                      </strong>
                      martelinhos no histórico
                    </span>
                  </div>
                ) : null}
              </div>

              {officeDetail?.recentServices?.length ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {officeDetail.recentServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex flex-col gap-2 p-3.5 transition hover:bg-surface-2/60 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {[service.veiculo?.marca, service.veiculo?.modelo]
                            .filter(Boolean)
                            .join(" ") || "Veículo sem descrição"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[service.veiculo?.placa, formatDate(service.data_servico, "IT")]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {formatMoney(service.valor)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : detailLoading ? (
                <div className="h-32 animate-pulse rounded-xl border border-border bg-surface-2" />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  Ainda não existem serviços cadastrados para esta oficina.
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="Excluir oficina"
        description="Esta ação remove apenas oficinas sem histórico de serviços."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} leftIcon={Trash2} onClick={confirmDelete}>
              Excluir oficina
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deseja realmente excluir <strong className="font-semibold text-foreground">{deleteTarget?.nome}</strong>?
          Se ela já possuir serviços, o sistema preservará o cadastro e pedirá para inativá-la.
        </p>
      </Modal>
    </div>
  );
}
