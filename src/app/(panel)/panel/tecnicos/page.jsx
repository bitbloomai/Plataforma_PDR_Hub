"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Globe2,
  ImagePlus,
  Landmark,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  UserRoundCheck,
  WalletCards,
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
import {
  formatDate,
  formatPersonDocument,
  formatPhone,
} from "@/lib/formatters";
import { maskPersonDocument, maskPhone } from "@/lib/inputMasks";

const PAGE_SIZES = [12, 24, 48];
const AVATAR_BUCKET = "perfis";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const COUNTRY_OPTIONS = {
  BR: {
    code: "BR",
    label: "Brasil",
    flag: "🇧🇷",
    dialCode: "55",
    dialLabel: "+55",
    documentLabel: "CPF",
  },
  IT: {
    code: "IT",
    label: "Itália",
    flag: "🇮🇹",
    dialCode: "39",
    dialLabel: "+39",
    documentLabel: "Codice Fiscale",
  },
};

const EMPTY_FORM = {
  nome: "",
  email: "",
  nacionalidade: "",
  telefone_pais: "IT",
  telefone: "",
  documento_pais: "BR",
  documento: "",
  pagamento_tipo: "",
  banco_pais: "IT",
  titular_pagamento: "",
  chave_pix: "",
  banco_nome: "",
  agencia: "",
  conta_bancaria: "",
  iban: "",
  bic_swift: "",
  dados_pagamento: "",
  observacoes: "",
  ativo: true,
};

const TECHNICIAN_SELECT = [
  "id",
  "conta_id",
  "nome",
  "email",
  "telefone",
  "telefone_pais",
  "nacionalidade",
  "documento",
  "documento_pais",
  "pagamento_tipo",
  "banco_pais",
  "titular_pagamento",
  "chave_pix",
  "banco_nome",
  "agencia",
  "conta_bancaria",
  "iban",
  "bic_swift",
  "dados_pagamento",
  "foto_url",
  "observacoes",
  "ativo",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(",");

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanAlphaNumeric(value) {
  const text = String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
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

function normalizeCountry(value, fallback = "IT") {
  const normalized = String(value || "").trim().toUpperCase();
  return COUNTRY_OPTIONS[normalized] ? normalized : fallback;
}

function countryMeta(value, fallback = "IT") {
  return COUNTRY_OPTIONS[normalizeCountry(value, fallback)];
}

function resolvePhoneCountry(phone, storedCountry) {
  if (COUNTRY_OPTIONS[String(storedCountry || "").toUpperCase()]) {
    return String(storedCountry).toUpperCase();
  }

  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55")) return "BR";
  if (digits.startsWith("39")) return "IT";
  return "IT";
}

function resolveDocumentCountry(document, storedCountry) {
  if (COUNTRY_OPTIONS[String(storedCountry || "").toUpperCase()]) {
    return String(storedCountry).toUpperCase();
  }

  const raw = String(document || "").replace(/[^a-zA-Z0-9]/g, "");
  if (/^\d{11}$/.test(raw)) return "BR";
  if (/^[a-zA-Z0-9]{16}$/.test(raw)) return "IT";
  return "BR";
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

function cleanDocument(value, country) {
  const code = normalizeCountry(country, "BR");
  if (code === "BR") {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits || null;
  }
  return cleanAlphaNumeric(value);
}

function phoneForInput(value, country) {
  if (!value) return "";

  const code = normalizeCountry(country);
  const meta = countryMeta(code);
  let digits = String(value).replace(/\D/g, "");

  if (digits.startsWith(meta.dialCode)) {
    digits = digits.slice(meta.dialCode.length);
  }

  return maskPhone(digits, code);
}

function phoneForDatabase(value, country) {
  const code = normalizeCountry(country);
  const meta = countryMeta(code);
  let digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.startsWith(meta.dialCode)) return digits;

  return `${meta.dialCode}${digits}`;
}

function isPaidStatus(value) {
  return ["pago", "paga", "recebido", "recebida", "paid"].includes(
    normalizeText(value)
  );
}

function getStoragePath(pathOrUrl) {
  if (!pathOrUrl) return null;

  const raw = String(pathOrUrl).trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^\/+/, "").replace(/^perfis\//, "") || null;
  }

  try {
    const url = new URL(raw);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;

    return decodeURIComponent(url.pathname.slice(index + marker.length)) || null;
  } catch {
    return null;
  }
}

function getPhotoUrl(supabase, pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const cleanPath = getStoragePath(pathOrUrl);
  if (!cleanPath) return null;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

function fileExtension(file) {
  const byName = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();

  if (["jpg", "jpeg", "png", "webp"].includes(byName)) {
    return byName === "jpeg" ? "jpg" : byName;
  }

  if (file?.type === "image/png") return "png";
  if (file?.type === "image/webp") return "webp";
  return "jpg";
}

function sortTechnicians(list) {
  return [...list].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "it", {
      sensitivity: "base",
    });
  });
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

function technicianAuditSnapshot(technician) {
  if (!technician) return null;

  return {
    id: technician.id || null,
    nome: technician.nome || null,
    email: technician.email || null,
    telefone: technician.telefone || null,
    telefone_pais: technician.telefone_pais || null,
    nacionalidade: technician.nacionalidade || null,
    documento_pais: technician.documento_pais || null,
    pagamento_tipo: technician.pagamento_tipo || null,
    banco_pais: technician.banco_pais || null,
    tem_dados_pagamento: Boolean(
      technician.chave_pix ||
        technician.conta_bancaria ||
        technician.iban ||
        technician.dados_pagamento
    ),
    foto_url: technician.foto_url || null,
    ativo: technician.ativo !== false,
    updated_at: technician.updated_at || null,
  };
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
        className={`size-1.5 rounded-full ${
          active ? "bg-success" : "bg-muted-foreground"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function CountryBadge({ code, emptyLabel = "Não informada" }) {
  if (!code) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {emptyLabel}
      </span>
    );
  }

  const meta = countryMeta(code);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
      <span aria-hidden="true">{meta.flag}</span>
      {meta.label}
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
  const sizeClass =
    size === "lg"
      ? "size-20 text-xl"
      : size === "sm"
        ? "size-9 text-[11px]"
        : "size-14 text-sm";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-foreground ${sizeClass}`}
      title={technician?.nome || "Técnico"}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={technician?.nome || "Técnico"}
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

function TechnicianCard({
  technician,
  photoUrl,
  officeLinks,
  pendingAmount,
  formatMoney,
  onOpen,
  onEdit,
  onDelete,
}) {
  const phoneCode = resolvePhoneCountry(technician.telefone, technician.telefone_pais);
  const visibleOffices = officeLinks.slice(0, 2);
  const extraOffices = Math.max(0, officeLinks.length - visibleOffices.length);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(technician)}
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
              <p className="text-[11px] font-medium text-muted-foreground">Pendente</p>
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
  const supabase = useMemo(() => createClient(), []);
  const meRef = useRef(null);
  const fileInputRef = useRef(null);
  const detailCacheRef = useRef(new Map());

  const [me, setMe] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [offices, setOffices] = useState([]);
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

  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [technicianDetail, setTechnicianDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [officeSearch, setOfficeSearch] = useState("");
  const [mutatingOfficeId, setMutatingOfficeId] = useState("");

  const contaId = me?.usuario?.conta_id || "";
  const usuarioId = me?.usuario?.id || "";

  const avatarPreviewUrl = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    if (removeAvatar) return null;
    return editingTechnician
      ? getPhotoUrl(supabase, editingTechnician.foto_url)
      : null;
  }, [avatarFile, editingTechnician, removeAvatar, supabase]);

  useEffect(() => {
    return () => {
      if (avatarFile && avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarFile, avatarPreviewUrl]);

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
        (map.get(movement.tecnico_id) || 0) + safeNumber(movement.valor)
      );
    });
    return map;
  }, [repasseMovements]);

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

        const [techniciansResult, officesResult, linksResult, movementsResult] =
          await Promise.all([
            supabase
              .from("tecnicos")
              .select(TECHNICIAN_SELECT)
              .eq("conta_id", currentContaId)
              .order("ativo", { ascending: false })
              .order("nome", { ascending: true })
              .range(0, 4999),
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
              .order("created_at", { ascending: true })
              .range(0, 4999),
            supabase
              .from("movimentacoes_financeiras")
              .select("id,tecnico_id,valor,status,origem")
              .eq("conta_id", currentContaId)
              .eq("origem", "repasse_tecnico")
              .not("tecnico_id", "is", null)
              .range(0, 4999),
          ]);

        if (techniciansResult.error) throw techniciansResult.error;
        if (officesResult.error) throw officesResult.error;
        if (linksResult.error) throw linksResult.error;
        if (movementsResult.error) throw movementsResult.error;

        setMe(meData);
        setTechnicians(techniciansResult.data || []);
        setOffices(officesResult.data || []);
        setLinks(linksResult.data || []);
        setRepasseMovements(movementsResult.data || []);
        detailCacheRef.current.clear();
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

  const metrics = useMemo(() => {
    const active = technicians.filter((technician) => technician.ativo).length;
    const allocated = new Set(links.map((link) => link.tecnico_id)).size;
    const pending = repasseMovements
      .filter((movement) => !isPaidStatus(movement.status))
      .reduce((sum, movement) => sum + safeNumber(movement.valor), 0);

    return {
      total: technicians.length,
      active,
      allocated,
      pending,
    };
  }, [links, repasseMovements, technicians]);

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
    setPage(1);
  }, [search, statusFilter, nationalityFilter, allocationFilter, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
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

  function resetAvatarState() {
    setAvatarFile(null);
    setRemoveAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const closeForm = useCallback(() => {
    if (saving) return;

    setFormOpen(false);
    setEditingTechnician(null);
    setFormErrors({});
    setAvatarFile(null);
    setRemoveAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [saving]);

  function openCreate() {
    setEditingTechnician(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    resetAvatarState();
    setFormOpen(true);
  }

  function openEdit(technician) {
    const phoneCountry = resolvePhoneCountry(technician.telefone, technician.telefone_pais);
    const documentCountry = resolveDocumentCountry(
      technician.documento,
      technician.documento_pais
    );

    setEditingTechnician(technician);
    setForm({
      nome: technician.nome || "",
      email: technician.email || "",
      nacionalidade: technician.nacionalidade || "",
      telefone_pais: phoneCountry,
      telefone: phoneForInput(technician.telefone, phoneCountry),
      documento_pais: documentCountry,
      documento: technician.documento
        ? maskPersonDocument(technician.documento, documentCountry)
        : "",
      pagamento_tipo: technician.pagamento_tipo || "",
      banco_pais: technician.banco_pais || "IT",
      titular_pagamento: technician.titular_pagamento || "",
      chave_pix: technician.chave_pix || "",
      banco_nome: technician.banco_nome || "",
      agencia: technician.agencia || "",
      conta_bancaria: technician.conta_bancaria || "",
      iban: technician.iban || "",
      bic_swift: technician.bic_swift || "",
      dados_pagamento: technician.dados_pagamento || "",
      observacoes: technician.observacoes || "",
      ativo: technician.ativo !== false,
    });
    setFormErrors({});
    resetAvatarState();
    setFormOpen(true);
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.nome.trim()) nextErrors.nome = "Informe o nome do técnico.";

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    if (form.pagamento_tipo === "pix" && !form.chave_pix.trim()) {
      nextErrors.chave_pix = "Informe a chave PIX.";
    }

    if (form.pagamento_tipo === "conta_br") {
      if (!form.banco_nome.trim()) nextErrors.banco_nome = "Informe o banco.";
      if (!form.agencia.trim()) nextErrors.agencia = "Informe a agência.";
      if (!form.conta_bancaria.trim()) {
        nextErrors.conta_bancaria = "Informe a conta.";
      }
    }

    if (form.pagamento_tipo === "iban") {
      const iban = cleanAlphaNumeric(form.iban) || "";
      if (!iban) nextErrors.iban = "Informe o IBAN.";
      else if (iban.length < 15 || iban.length > 34) {
        nextErrors.iban = "O IBAN deve possuir entre 15 e 34 caracteres.";
      }
    }

    if (avatarFile) {
      if (!ALLOWED_AVATAR_TYPES.includes(avatarFile.type)) {
        nextErrors.foto = "Use uma imagem JPG, PNG ou WebP.";
      } else if (avatarFile.size > MAX_AVATAR_SIZE) {
        nextErrors.foto = "A imagem deve ter no máximo 5 MB.";
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleAvatarPick(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.warning("Formato não suportado", "Use uma imagem JPG, PNG ou WebP.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.warning("Imagem muito grande", "O avatar pode ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setFormErrors((current) => ({ ...current, foto: undefined }));
  }

  async function uploadAvatar(file, currentContaId, technicianId) {
    const extension = fileExtension(file);
    const random = Math.random().toString(36).slice(2, 8);
    const path = `tecnicos/${currentContaId}/${technicianId}-${Date.now()}-${random}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;
    return path;
  }

  async function removeAvatarFromStorage(pathOrUrl) {
    const path = getStoragePath(pathOrUrl);
    if (!path) return;

    const { error: removeError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove([path]);

    if (removeError) {
      console.warn("Avatar antigo não removido", removeError);
    }
  }

  async function logAudit({
    action,
    technicianId,
    description,
    before = null,
    after = null,
  }) {
    const currentMe = meRef.current || me;
    const currentContaId = currentMe?.usuario?.conta_id;
    const currentUsuarioId = currentMe?.usuario?.id;
    if (!currentContaId) return;

    try {
      await supabase.from("auditoria").insert({
        conta_id: currentContaId,
        usuario_id: currentUsuarioId || null,
        entidade: "tecnicos",
        acao: action,
        registro_id: technicianId || null,
        descricao: description,
        dados_anteriores: before,
        dados_novos: after,
      });
    } catch (auditError) {
      console.warn("Auditoria de técnico não registrada", auditError);
    }
  }

  function buildPaymentPayload() {
    const paymentType = cleanText(form.pagamento_tipo);

    return {
      pagamento_tipo: paymentType,
      banco_pais: paymentType ? cleanText(form.banco_pais) : null,
      titular_pagamento: paymentType ? cleanText(form.titular_pagamento) : null,
      chave_pix: paymentType === "pix" ? cleanText(form.chave_pix) : null,
      banco_nome:
        paymentType === "conta_br" || paymentType === "iban"
          ? cleanText(form.banco_nome)
          : null,
      agencia: paymentType === "conta_br" ? cleanText(form.agencia) : null,
      conta_bancaria:
        paymentType === "conta_br" ? cleanText(form.conta_bancaria) : null,
      iban: paymentType === "iban" ? cleanAlphaNumeric(form.iban) : null,
      bic_swift:
        paymentType === "iban" ? cleanAlphaNumeric(form.bic_swift) : null,
      dados_pagamento:
        paymentType === "outro" || form.dados_pagamento.trim()
          ? cleanText(form.dados_pagamento)
          : null,
    };
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
      email: cleanText(form.email)?.toLowerCase() || null,
      nacionalidade: cleanText(form.nacionalidade),
      telefone_pais: normalizeCountry(form.telefone_pais),
      telefone: phoneForDatabase(form.telefone, form.telefone_pais),
      documento_pais: normalizeCountry(form.documento_pais, "BR"),
      documento: cleanDocument(form.documento, form.documento_pais),
      ...buildPaymentPayload(),
      observacoes: cleanText(form.observacoes),
      ativo: Boolean(form.ativo),
      updated_by: currentUsuarioId || null,
      updated_at: new Date().toISOString(),
    };

    let uploadedPath = null;
    let createdId = null;

    try {
      if (editingTechnician) {
        const before = technicianAuditSnapshot(editingTechnician);
        const oldPhotoPath = editingTechnician.foto_url;

        if (avatarFile) {
          uploadedPath = await uploadAvatar(
            avatarFile,
            currentContaId,
            editingTechnician.id
          );
          payload.foto_url = uploadedPath;
        } else if (removeAvatar) {
          payload.foto_url = null;
        }

        const { data, error: updateError } = await supabase
          .from("tecnicos")
          .update(payload)
          .eq("id", editingTechnician.id)
          .eq("conta_id", currentContaId)
          .select(TECHNICIAN_SELECT)
          .single();

        if (updateError) throw updateError;

        if ((avatarFile || removeAvatar) && oldPhotoPath) {
          await removeAvatarFromStorage(oldPhotoPath);
        }

        setTechnicians((current) =>
          sortTechnicians(
            current.map((technician) =>
              technician.id === data.id ? data : technician
            )
          )
        );

        if (selectedTechnician?.id === data.id) setSelectedTechnician(data);
        detailCacheRef.current.delete(data.id);

        await logAudit({
          action: "atualizar",
          technicianId: data.id,
          description: `Técnico ${data.nome} atualizado.`,
          before,
          after: technicianAuditSnapshot(data),
        });

        toast.success("Técnico atualizado", "As alterações foram salvas com sucesso.");
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("tecnicos")
          .insert({
            ...payload,
            conta_id: currentContaId,
            created_by: currentUsuarioId || null,
          })
          .select(TECHNICIAN_SELECT)
          .single();

        if (insertError) throw insertError;
        createdId = inserted.id;

        let finalData = inserted;

        if (avatarFile) {
          uploadedPath = await uploadAvatar(
            avatarFile,
            currentContaId,
            inserted.id
          );

          const { data: withPhoto, error: photoUpdateError } = await supabase
            .from("tecnicos")
            .update({
              foto_url: uploadedPath,
              updated_by: currentUsuarioId || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inserted.id)
            .eq("conta_id", currentContaId)
            .select(TECHNICIAN_SELECT)
            .single();

          if (photoUpdateError) throw photoUpdateError;
          finalData = withPhoto;
        }

        setTechnicians((current) => sortTechnicians([...current, finalData]));

        await logAudit({
          action: "criar",
          technicianId: finalData.id,
          description: `Técnico ${finalData.nome} criado.`,
          after: technicianAuditSnapshot(finalData),
        });

        toast.success("Técnico criado", "O profissional já está disponível para a operação.");
      }

      setFormOpen(false);
      setEditingTechnician(null);
      setForm(EMPTY_FORM);
      setFormErrors({});
      resetAvatarState();
    } catch (saveError) {
      console.error("Salvar técnico", saveError);

      if (uploadedPath) {
        await removeAvatarFromStorage(uploadedPath);
      }

      if (createdId) {
        const { error: rollbackError } = await supabase
          .from("tecnicos")
          .delete()
          .eq("id", createdId)
          .eq("conta_id", currentContaId);

        if (rollbackError) {
          console.warn("Rollback do técnico não concluído", rollbackError);
        }
      }

      toast.error(
        "Não foi possível salvar",
        saveError?.message || "Verifique os dados e tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  const loadTechnicianDetail = useCallback(
    async (technicianId, { force = false } = {}) => {
      if (!technicianId || !contaId) return;

      const cached = detailCacheRef.current.get(technicianId);
      if (!force && cached) {
        setTechnicianDetail(cached);
        return;
      }

      setDetailLoading(true);

      try {
        const [relationsResult, movementsResult] = await Promise.all([
          supabase
            .from("servicos_tecnicos")
            .select(
              `
                id,
                percentual,
                valor_repasse,
                created_at,
                servico:servicos!inner(
                  id,
                  data_servico,
                  valor,
                  descricao,
                  observacoes,
                  oficina_id,
                  veiculo_id,
                  oficina:oficinas(id,nome,cidade,pais),
                  veiculo:veiculos(id,placa,marca,modelo,ano,cor)
                )
              `
            )
            .eq("conta_id", contaId)
            .eq("tecnico_id", technicianId)
            .order("created_at", { ascending: false })
            .range(0, 4999),
          supabase
            .from("movimentacoes_financeiras")
            .select(
              "id,valor,status,data_competencia,data_vencimento,data_pagamento,forma_pagamento,servico_id"
            )
            .eq("conta_id", contaId)
            .eq("tecnico_id", technicianId)
            .eq("origem", "repasse_tecnico")
            .order("data_competencia", { ascending: false })
            .range(0, 4999),
        ]);

        if (relationsResult.error) throw relationsResult.error;
        if (movementsResult.error) throw movementsResult.error;

        const relations = relationsResult.data || [];
        const movements = movementsResult.data || [];
        const totalServiceValue = relations.reduce(
          (sum, relation) => sum + safeNumber(relation.servico?.valor),
          0
        );
        const totalGenerated = relations.reduce(
          (sum, relation) => sum + safeNumber(relation.valor_repasse),
          0
        );
        const totalPaid = movements
          .filter((movement) => isPaidStatus(movement.status))
          .reduce((sum, movement) => sum + safeNumber(movement.valor), 0);
        const totalPending = movements
          .filter((movement) => !isPaidStatus(movement.status))
          .reduce((sum, movement) => sum + safeNumber(movement.valor), 0);

        const sortedRelations = [...relations].sort((a, b) => {
          const aDate = a.servico?.data_servico || a.created_at || "";
          const bDate = b.servico?.data_servico || b.created_at || "";
          return String(bDate).localeCompare(String(aDate));
        });

        const detail = {
          totalServices: relations.length,
          totalServiceValue,
          totalGenerated,
          totalPaid,
          totalPending,
          averageTicket: relations.length ? totalServiceValue / relations.length : 0,
          historicalOffices: new Set(
            relations.map((relation) => relation.servico?.oficina_id).filter(Boolean)
          ).size,
          recentServices: sortedRelations.slice(0, 8),
        };

        detailCacheRef.current.set(technicianId, detail);
        setTechnicianDetail(detail);
      } catch (detailError) {
        console.error("Detalhe técnico", detailError);
        setTechnicianDetail(null);
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

  function openDetail(technician) {
    setSelectedTechnician(technician);
    setTechnicianDetail(null);
    setOfficeSearch("");
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!detailOpen || !selectedTechnician?.id || !contaId) return;
    loadTechnicianDetail(selectedTechnician.id);
  }, [
    contaId,
    detailOpen,
    loadTechnicianDetail,
    selectedTechnician?.id,
  ]);

  const selectedLinks = selectedTechnician
    ? linksByTechnician.get(selectedTechnician.id) || []
    : [];

  const selectedOfficeIds = useMemo(
    () => new Set(selectedLinks.map((link) => link.oficina_id)),
    [selectedLinks]
  );

  const pickerOffices = useMemo(() => {
    const term = normalizeText(officeSearch);

    return offices
      .filter((office) => office.ativo || selectedOfficeIds.has(office.id))
      .filter((office) => {
        if (!term) return true;
        return normalizeText(
          [office.nome, office.cidade, office.estado_regiao, office.pais]
            .filter(Boolean)
            .join(" ")
        ).includes(term);
      })
      .sort((a, b) => {
        const aSelected = selectedOfficeIds.has(a.id);
        const bSelected = selectedOfficeIds.has(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return String(a.nome || "").localeCompare(String(b.nome || ""), "it", {
          sensitivity: "base",
        });
      });
  }, [officeSearch, offices, selectedOfficeIds]);

  async function toggleOffice(office) {
    if (!selectedTechnician || !contaId || mutatingOfficeId) return;

    const technicianLinks = linksByTechnician.get(selectedTechnician.id) || [];
    const existing = technicianLinks.find((link) => link.oficina_id === office.id);
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

        await logAudit({
          action: "desvincular_oficina",
          technicianId: selectedTechnician.id,
          description: `${selectedTechnician.nome} removido da oficina ${office.nome}.`,
          before: {
            tecnico_id: selectedTechnician.id,
            oficina_id: office.id,
          },
        });

        toast.success("Oficina removida", `${office.nome} foi removida deste técnico.`);
      } else {
        const { data, error: insertError } = await supabase
          .from("oficinas_martelinhos")
          .insert({
            conta_id: contaId,
            oficina_id: office.id,
            tecnico_id: selectedTechnician.id,
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

        await logAudit({
          action: "vincular_oficina",
          technicianId: selectedTechnician.id,
          description: `${selectedTechnician.nome} vinculado à oficina ${office.nome}.`,
          after: {
            tecnico_id: selectedTechnician.id,
            oficina_id: office.id,
          },
        });

        toast.success("Oficina vinculada", `${selectedTechnician.nome} agora aparece em ${office.nome}.`);
      }
    } catch (relationError) {
      console.error("Vínculo técnico/oficina", relationError);
      toast.error(
        "Não foi possível alterar o vínculo",
        relationError?.message || "Tente novamente."
      );
    } finally {
      setMutatingOfficeId("");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !contaId) return;
    setDeleting(true);

    try {
      const [servicesCountResult, movementsCountResult] = await Promise.all([
        supabase
          .from("servicos_tecnicos")
          .select("id", { count: "exact", head: true })
          .eq("conta_id", contaId)
          .eq("tecnico_id", deleteTarget.id),
        supabase
          .from("movimentacoes_financeiras")
          .select("id", { count: "exact", head: true })
          .eq("conta_id", contaId)
          .eq("tecnico_id", deleteTarget.id),
      ]);

      if (servicesCountResult.error) throw servicesCountResult.error;
      if (movementsCountResult.error) throw movementsCountResult.error;

      const hasHistory =
        (servicesCountResult.count || 0) > 0 ||
        (movementsCountResult.count || 0) > 0;

      if (hasHistory) {
        toast.warning(
          "Técnico possui histórico",
          "Existem serviços ou movimentações vinculadas. Para preservar o histórico, edite o técnico e marque como inativo."
        );
        setDeleteTarget(null);
        return;
      }

      const before = technicianAuditSnapshot(deleteTarget);
      const avatarToDelete = deleteTarget.foto_url;

      const { error: deleteError } = await supabase
        .from("tecnicos")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("conta_id", contaId);

      if (deleteError) throw deleteError;

      if (avatarToDelete) await removeAvatarFromStorage(avatarToDelete);

      setTechnicians((current) =>
        current.filter((technician) => technician.id !== deleteTarget.id)
      );
      setLinks((current) =>
        current.filter((link) => link.tecnico_id !== deleteTarget.id)
      );
      setRepasseMovements((current) =>
        current.filter((movement) => movement.tecnico_id !== deleteTarget.id)
      );
      detailCacheRef.current.delete(deleteTarget.id);

      if (selectedTechnician?.id === deleteTarget.id) {
        setDetailOpen(false);
        setSelectedTechnician(null);
        setTechnicianDetail(null);
      }

      await logAudit({
        action: "excluir",
        technicianId: deleteTarget.id,
        description: `Técnico ${deleteTarget.nome} excluído.`,
        before,
      });

      toast.success("Técnico excluído", "O cadastro foi removido com sucesso.");
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error("Excluir técnico", deleteError);
      toast.error(
        "Não foi possível excluir",
        deleteError?.message || "Tente novamente."
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedPhotoUrl = selectedTechnician
    ? getPhotoUrl(supabase, selectedTechnician.foto_url)
    : null;
  const selectedPhoneCode = resolvePhoneCountry(
    selectedTechnician?.telefone,
    selectedTechnician?.telefone_pais
  );
  const selectedDocumentCode = resolveDocumentCountry(
    selectedTechnician?.documento,
    selectedTechnician?.documento_pais
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Cadastre os profissionais, organize as oficinas e acompanhe repasses e histórico.
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
              onOpen={openDetail}
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

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingTechnician ? "Editar técnico" : "Novo técnico"}
        description="Dados pessoais, contato e informações de pagamento do profissional."
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="technician-form"
              loading={saving}
              leftIcon={editingTechnician ? Pencil : Plus}
            >
              {editingTechnician ? "Salvar alterações" : "Criar técnico"}
            </Button>
          </>
        }
      >
        <Form id="technician-form" onSubmit={handleSave}>
          <FormSection
            title="Foto do técnico"
            description="A imagem é armazenada no bucket público de perfis. JPG, PNG ou WebP de até 5 MB."
          >
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center">
              <Avatar
                technician={{ nome: form.nome || "Técnico" }}
                photoUrl={avatarPreviewUrl}
                size="lg"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {avatarFile
                    ? avatarFile.name
                    : editingTechnician?.foto_url && !removeAvatar
                      ? "Foto atual do cadastro"
                      : "Nenhuma foto selecionada"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ao trocar a foto, um novo nome de arquivo é gerado para evitar cache da imagem anterior.
                </p>
                {formErrors.foto ? (
                  <p className="mt-2 text-xs font-medium text-danger">{formErrors.foto}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarPick}
                />
                <Button
                  type="button"
                  variant="outline"
                  leftIcon={avatarPreviewUrl ? Upload : ImagePlus}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreviewUrl ? "Trocar foto" : "Escolher foto"}
                </Button>

                {avatarPreviewUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    leftIcon={Trash2}
                    onClick={() => {
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Dados principais"
            description="Identificação e contato do profissional."
          >
            <FormGrid>
              <FormField label="Nome" required error={formErrors.nome}>
                <Input
                  value={form.nome}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, nome: event.target.value }))
                  }
                  placeholder="Ex.: Mateus Silva"
                />
              </FormField>

              <FormField label="Nacionalidade">
                <Select
                  value={form.nacionalidade}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nacionalidade: event.target.value,
                    }))
                  }
                >
                  <option value="">Não informada</option>
                  <option value="BR">🇧🇷 Brasileira</option>
                  <option value="IT">🇮🇹 Italiana</option>
                </Select>
              </FormField>

              <FormField label="E-mail" error={formErrors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="tecnico@email.com"
                />
              </FormField>

              <FormField label="Telefone">
                <div className="flex gap-2">
                  <Select
                    value={form.telefone_pais}
                    onChange={(event) => {
                      const nextCountry = event.target.value;
                      setForm((current) => ({
                        ...current,
                        telefone_pais: nextCountry,
                        telefone: maskPhone(
                          String(current.telefone || "").replace(/\D/g, ""),
                          nextCountry
                        ),
                      }));
                    }}
                    className="w-32 shrink-0"
                    aria-label="País do telefone"
                  >
                    <option value="BR">🇧🇷 +55</option>
                    <option value="IT">🇮🇹 +39</option>
                  </Select>
                  <Input
                    type="tel"
                    value={form.telefone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        telefone: maskPhone(
                          event.target.value,
                          current.telefone_pais
                        ),
                      }))
                    }
                    placeholder={form.telefone_pais === "BR" ? "(31) 99999-9999" : "333 123 4567"}
                  />
                </div>
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Documento"
            description="O documento é formatado conforme o país selecionado e salvo sem máscara."
          >
            <FormGrid>
              <FormField label="País do documento">
                <Select
                  value={form.documento_pais}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setForm((current) => ({
                      ...current,
                      documento_pais: nextCountry,
                      documento: "",
                    }));
                  }}
                >
                  <option value="BR">🇧🇷 Brasil · CPF</option>
                  <option value="IT">🇮🇹 Itália · Codice Fiscale</option>
                </Select>
              </FormField>

              <FormField label={countryMeta(form.documento_pais, "BR").documentLabel}>
                <Input
                  value={form.documento}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      documento: maskPersonDocument(
                        event.target.value,
                        current.documento_pais
                      ),
                    }))
                  }
                  placeholder={
                    form.documento_pais === "BR"
                      ? "000.000.000-00"
                      : "RSSMRA85T10A562S"
                  }
                />
              </FormField>
            </FormGrid>
          </FormSection>

          <FormSection
            title="Pagamento"
            description="Escolha a forma principal para repasses. Os campos são internos e não aparecem nos cards."
          >
            <FormGrid>
              <FormField label="Forma principal de pagamento">
                <Select
                  value={form.pagamento_tipo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pagamento_tipo: event.target.value,
                    }))
                  }
                >
                  <option value="">Não informada</option>
                  <option value="pix">PIX</option>
                  <option value="conta_br">Conta bancária brasileira</option>
                  <option value="iban">IBAN / SEPA / conta internacional</option>
                  <option value="outro">Outro</option>
                </Select>
              </FormField>

              {form.pagamento_tipo ? (
                <FormField label="País da conta">
                  <Select
                    value={form.banco_pais}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        banco_pais: event.target.value,
                      }))
                    }
                  >
                    <option value="BR">🇧🇷 Brasil</option>
                    <option value="IT">🇮🇹 Itália</option>
                    <option value="OUTRO">🌍 Outro / global</option>
                  </Select>
                </FormField>
              ) : null}

              {form.pagamento_tipo ? (
                <FormField label="Titular da conta">
                  <Input
                    value={form.titular_pagamento}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        titular_pagamento: event.target.value,
                      }))
                    }
                    placeholder="Nome do titular"
                  />
                </FormField>
              ) : null}

              {form.pagamento_tipo === "pix" ? (
                <FormField label="Chave PIX" required error={formErrors.chave_pix}>
                  <Input
                    value={form.chave_pix}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        chave_pix: event.target.value,
                      }))
                    }
                    placeholder="CPF, telefone, e-mail ou chave aleatória"
                  />
                </FormField>
              ) : null}

              {form.pagamento_tipo === "conta_br" ? (
                <>
                  <FormField label="Banco" required error={formErrors.banco_nome}>
                    <Input
                      value={form.banco_nome}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          banco_nome: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Sicoob"
                    />
                  </FormField>

                  <FormField label="Agência" required error={formErrors.agencia}>
                    <Input
                      value={form.agencia}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          agencia: event.target.value,
                        }))
                      }
                      placeholder="0001"
                    />
                  </FormField>

                  <FormField label="Conta" required error={formErrors.conta_bancaria}>
                    <Input
                      value={form.conta_bancaria}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          conta_bancaria: event.target.value,
                        }))
                      }
                      placeholder="12345-6"
                    />
                  </FormField>
                </>
              ) : null}

              {form.pagamento_tipo === "iban" ? (
                <>
                  <FormField label="Banco / instituição">
                    <Input
                      value={form.banco_nome}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          banco_nome: event.target.value,
                        }))
                      }
                      placeholder="Ex.: Intesa Sanpaolo / Wise"
                    />
                  </FormField>

                  <FormField label="IBAN" required error={formErrors.iban}>
                    <Input
                      value={form.iban}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          iban: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="IT60X0542811101000000123456"
                    />
                  </FormField>

                  <FormField label="BIC / SWIFT">
                    <Input
                      value={form.bic_swift}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          bic_swift: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="BCITITMM"
                    />
                  </FormField>
                </>
              ) : null}
            </FormGrid>

            {form.pagamento_tipo ? (
              <FormField label="Informações adicionais de pagamento">
                <Textarea
                  value={form.dados_pagamento}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dados_pagamento: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Observações sobre o recebimento, conta global, referência, instruções internas..."
                />
              </FormField>
            ) : null}
          </FormSection>

          <FormSection title="Operação" description="Status e observações internas.">
            <FormGrid>
              <FormField label="Técnico ativo">
                <div className="flex min-h-10 items-center gap-3 rounded-lg border border-border bg-background px-3">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, ativo: checked }))
                    }
                    id="tecnico-ativo"
                  />

                  <label
                    htmlFor="tecnico-ativo"
                    className="cursor-pointer text-sm text-muted-foreground"
                  >
                    {form.ativo
                      ? "Disponível para novos serviços"
                      : "Mantido apenas para histórico"}
                  </label>
                </div>
              </FormField>
            </FormGrid>

            <FormField label="Observações">
              <Textarea
                value={form.observacoes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    observacoes: event.target.value,
                  }))
                }
                rows={4}
                placeholder="Especialidades, disponibilidade, região de atuação, informações internas..."
              />
            </FormField>
          </FormSection>
        </Form>
      </Modal>

      <Drawer
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTechnician(null);
          setTechnicianDetail(null);
          setOfficeSearch("");
        }}
        title={selectedTechnician?.nome || "Detalhes do técnico"}
        footer={
          selectedTechnician ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="danger"
                leftIcon={Trash2}
                onClick={() => setDeleteTarget(selectedTechnician)}
              >
                Excluir
              </Button>
              <Button
                variant="outline"
                leftIcon={Pencil}
                onClick={() => openEdit(selectedTechnician)}
              >
                Editar técnico
              </Button>
            </div>
          ) : null
        }
      >
        {selectedTechnician ? (
          <div className="space-y-6 pb-2">
            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  technician={selectedTechnician}
                  photoUrl={selectedPhotoUrl}
                  size="lg"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-foreground">
                    {selectedTechnician.nome}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge active={selectedTechnician.ativo} />
                    <CountryBadge code={selectedTechnician.nacionalidade} />
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs font-medium text-muted-foreground">Oficinas atuais</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {selectedLinks.length}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-foreground">Resumo operacional</h3>
                <p className="text-sm text-muted-foreground">
                  Indicadores acumulados da participação deste técnico.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem icon={Wrench} label="Serviços realizados">
                  {detailLoading ? "Carregando..." : technicianDetail?.totalServices ?? 0}
                </InfoItem>
                <InfoItem icon={CircleDollarSign} label="Valor dos serviços">
                  {detailLoading
                    ? "Carregando..."
                    : formatMoney(technicianDetail?.totalServiceValue || 0)}
                </InfoItem>
                <InfoItem icon={ReceiptText} label="Repasses gerados">
                  {detailLoading
                    ? "Carregando..."
                    : formatMoney(technicianDetail?.totalGenerated || 0)}
                </InfoItem>
                <InfoItem icon={BadgeCheck} label="Total pago">
                  {detailLoading
                    ? "Carregando..."
                    : formatMoney(technicianDetail?.totalPaid || 0)}
                </InfoItem>
                <InfoItem icon={Banknote} label="Total pendente">
                  <span
                    className={
                      safeNumber(technicianDetail?.totalPending) > 0
                        ? "text-warning"
                        : "text-foreground"
                    }
                  >
                    {detailLoading
                      ? "Carregando..."
                      : formatMoney(technicianDetail?.totalPending || 0)}
                  </span>
                </InfoItem>
                <InfoItem icon={WalletCards} label="Ticket médio dos serviços">
                  {detailLoading
                    ? "Carregando..."
                    : formatMoney(technicianDetail?.averageTicket || 0)}
                </InfoItem>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Oficinas atuais</h3>
                  <p className="text-sm text-muted-foreground">
                    Clique para vincular ou remover. As selecionadas aparecem primeiro.
                  </p>
                </div>

                <div className="relative w-full sm:max-w-xs">
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
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pickerOffices.map((office) => {
                  const linked = selectedOfficeIds.has(office.id);
                  const busy = mutatingOfficeId === office.id;

                  return (
                    <button
                      key={office.id}
                      type="button"
                      aria-pressed={linked}
                      disabled={Boolean(mutatingOfficeId)}
                      onClick={() => toggleOffice(office)}
                      className={`group flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-70 ${
                        linked
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-background hover:border-border-strong hover:bg-surface-2"
                      }`}
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                          linked
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-2 text-muted-foreground"
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
                        <p className="truncate text-sm font-medium text-foreground">
                          {office.nome}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[office.cidade, office.pais].filter(Boolean).join(", ") ||
                            "Localização não informada"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!pickerOffices.length ? (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
                  Nenhuma oficina encontrada para esta busca.
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-foreground">Dados do técnico</h3>
                <p className="text-sm text-muted-foreground">Contato e identificação.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem icon={Phone} label="Telefone">
                  {selectedTechnician.telefone
                    ? `${countryMeta(selectedPhoneCode).flag} ${formatPhone(
                        selectedTechnician.telefone,
                        selectedPhoneCode
                      )}`
                    : "Não informado"}
                </InfoItem>
                <InfoItem icon={Mail} label="E-mail" value={selectedTechnician.email} />
                <InfoItem icon={Globe2} label="Nacionalidade">
                  {selectedTechnician.nacionalidade ? (
                    <span className="inline-flex items-center gap-1.5">
                      {countryMeta(selectedTechnician.nacionalidade).flag}{" "}
                      {countryMeta(selectedTechnician.nacionalidade).label}
                    </span>
                  ) : (
                    "Não informada"
                  )}
                </InfoItem>
                <InfoItem
                  icon={FileText}
                  label={countryMeta(selectedDocumentCode, "BR").documentLabel}
                >
                  {selectedTechnician.documento
                    ? formatPersonDocument(
                        selectedTechnician.documento,
                        selectedDocumentCode
                      )
                    : "Não informado"}
                </InfoItem>
                <InfoItem label="Criado em" value={formatDateTime(selectedTechnician.created_at)} />
                <InfoItem
                  label="Última atualização"
                  value={formatDateTime(selectedTechnician.updated_at)}
                />
              </div>

              <div className="mt-3 rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-medium text-muted-foreground">Observações</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                  {selectedTechnician.observacoes || "Nenhuma observação cadastrada."}
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-foreground">Dados para pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  Informações internas usadas para os repasses do profissional.
                </p>
              </div>

              {selectedTechnician.pagamento_tipo ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem icon={WalletCards} label="Forma">
                    {selectedTechnician.pagamento_tipo === "pix"
                      ? "PIX"
                      : selectedTechnician.pagamento_tipo === "conta_br"
                        ? "Conta bancária brasileira"
                        : selectedTechnician.pagamento_tipo === "iban"
                          ? "IBAN / SEPA / internacional"
                          : "Outro"}
                  </InfoItem>
                  <InfoItem icon={Globe2} label="País da conta">
                    {selectedTechnician.banco_pais === "BR"
                      ? "🇧🇷 Brasil"
                      : selectedTechnician.banco_pais === "IT"
                        ? "🇮🇹 Itália"
                        : selectedTechnician.banco_pais
                          ? "🌍 Outro / global"
                          : "Não informado"}
                  </InfoItem>
                  <InfoItem
                    icon={UserRound}
                    label="Titular"
                    value={selectedTechnician.titular_pagamento}
                  />

                  {selectedTechnician.pagamento_tipo === "pix" ? (
                    <InfoItem
                      icon={ReceiptText}
                      label="Chave PIX"
                      value={selectedTechnician.chave_pix}
                    />
                  ) : null}

                  {selectedTechnician.pagamento_tipo === "conta_br" ? (
                    <>
                      <InfoItem
                        icon={Landmark}
                        label="Banco"
                        value={selectedTechnician.banco_nome}
                      />
                      <InfoItem label="Agência" value={selectedTechnician.agencia} />
                      <InfoItem
                        label="Conta"
                        value={selectedTechnician.conta_bancaria}
                      />
                    </>
                  ) : null}

                  {selectedTechnician.pagamento_tipo === "iban" ? (
                    <>
                      <InfoItem
                        icon={Landmark}
                        label="Banco / instituição"
                        value={selectedTechnician.banco_nome}
                      />
                      <InfoItem label="IBAN" value={selectedTechnician.iban} />
                      <InfoItem label="BIC / SWIFT" value={selectedTechnician.bic_swift} />
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  Nenhum dado estruturado de pagamento cadastrado.
                </div>
              )}

              {selectedTechnician.dados_pagamento ? (
                <div className="mt-3 rounded-lg border border-border bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Informações adicionais
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">
                    {selectedTechnician.dados_pagamento}
                  </p>
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Últimos serviços</h3>
                  <p className="text-sm text-muted-foreground">
                    Histórico recente com oficina, veículo, percentual e repasse.
                  </p>
                </div>

                {technicianDetail ? (
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <strong className="block text-sm font-semibold text-foreground">
                      {technicianDetail.historicalOffices}
                    </strong>
                    oficinas no histórico
                  </div>
                ) : null}
              </div>

              {technicianDetail?.recentServices?.length ? (
                <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {technicianDetail.recentServices.map((relation) => {
                    const service = relation.servico;
                    return (
                      <div
                        key={relation.id}
                        className="flex flex-col gap-3 p-3.5 transition hover:bg-surface-2/60 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {[service?.veiculo?.marca, service?.veiculo?.modelo]
                              .filter(Boolean)
                              .join(" ") || "Veículo sem descrição"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[
                              service?.veiculo?.placa,
                              service?.oficina?.nome,
                              service?.data_servico
                                ? formatDate(service.data_servico, "IT")
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>

                        <div className="grid shrink-0 grid-cols-3 gap-3 text-left text-xs lg:text-right">
                          <div>
                            <span className="block text-muted-foreground">Serviço</span>
                            <strong className="mt-0.5 block text-sm font-semibold text-foreground">
                              {formatMoney(service?.valor || 0)}
                            </strong>
                          </div>
                          <div>
                            <span className="block text-muted-foreground">Percentual</span>
                            <strong className="mt-0.5 block text-sm font-semibold text-foreground">
                              {safeNumber(relation.percentual).toLocaleString("pt-BR", {
                                maximumFractionDigits: 2,
                              })}
                              %
                            </strong>
                          </div>
                          <div>
                            <span className="block text-muted-foreground">Repasse</span>
                            <strong className="mt-0.5 block text-sm font-semibold text-foreground">
                              {formatMoney(relation.valor_repasse || 0)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : detailLoading ? (
                <div className="h-36 animate-pulse rounded-xl border border-border bg-surface-2" />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
                  Ainda não existem serviços vinculados a este técnico.
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
        title="Excluir técnico"
        description="A exclusão é permitida apenas quando não existe histórico operacional ou financeiro."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              leftIcon={Trash2}
              onClick={confirmDelete}
            >
              Excluir técnico
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Deseja realmente excluir{" "}
          <strong className="font-semibold text-foreground">{deleteTarget?.nome}</strong>?
          Se já houver serviços ou repasses, o sistema preservará o cadastro e pedirá para
          inativá-lo.
        </p>
      </Modal>
    </div>
  );
}
