import { maskPhone } from "@/lib/inputMasks";

export const AVATAR_BUCKET = "perfis";
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const COUNTRY_OPTIONS = {
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

export const EMPTY_TECHNICIAN_FORM = {
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

export const TECHNICIAN_SELECT = [
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

export const PAYMENT_TYPE_LABELS = {
  pix: "PIX",
  conta_br: "Conta bancária brasileira",
  iban: "IBAN / SEPA / internacional",
  outro: "Outro",
};

export function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function cleanAlphaNumeric(value) {
  const text = String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return text || null;
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeCountry(value, fallback = "IT") {
  const normalized = String(value || "").trim().toUpperCase();
  return COUNTRY_OPTIONS[normalized] ? normalized : fallback;
}

export function countryMeta(value, fallback = "IT") {
  return COUNTRY_OPTIONS[normalizeCountry(value, fallback)];
}

export function resolvePhoneCountry(phone, storedCountry) {
  if (COUNTRY_OPTIONS[String(storedCountry || "").toUpperCase()]) {
    return String(storedCountry).toUpperCase();
  }

  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("55")) return "BR";
  if (digits.startsWith("39")) return "IT";
  return "IT";
}

export function resolveDocumentCountry(document, storedCountry) {
  if (COUNTRY_OPTIONS[String(storedCountry || "").toUpperCase()]) {
    return String(storedCountry).toUpperCase();
  }

  const raw = String(document || "").replace(/[^a-zA-Z0-9]/g, "");
  if (/^\d{11}$/.test(raw)) return "BR";
  if (/^[a-zA-Z0-9]{16}$/.test(raw)) return "IT";
  return "BR";
}

export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function cleanDocument(value, country) {
  const code = normalizeCountry(country, "BR");
  if (code === "BR") {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits || null;
  }
  return cleanAlphaNumeric(value);
}

export function phoneForInput(value, country) {
  if (!value) return "";

  const code = normalizeCountry(country);
  const meta = countryMeta(code);
  let digits = String(value).replace(/\D/g, "");

  if (digits.startsWith(meta.dialCode)) {
    digits = digits.slice(meta.dialCode.length);
  }

  return maskPhone(digits, code);
}

export function phoneForDatabase(value, country) {
  const code = normalizeCountry(country);
  const meta = countryMeta(code);
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.startsWith(meta.dialCode)) return digits;

  return `${meta.dialCode}${digits}`;
}

export function isPaidStatus(value) {
  return ["pago", "paga", "recebido", "recebida", "paid"].includes(
    normalizeText(value)
  );
}

export function getStoragePath(pathOrUrl) {
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

export function getPhotoUrl(supabase, pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const cleanPath = getStoragePath(pathOrUrl);
  if (!cleanPath) return null;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(cleanPath);
  return data?.publicUrl || null;
}

export function fileExtension(file) {
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

export function uniqueUploadSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sortTechnicians(list) {
  return [...list].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return String(a.nome || "").localeCompare(String(b.nome || ""), "it", {
      sensitivity: "base",
    });
  });
}

export async function fetchMe() {
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

export function technicianAuditSnapshot(technician) {
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

export async function logAudit(
  supabase,
  me,
  { entity = "tecnicos", action, recordId, description, before = null, after = null }
) {
  const currentContaId = me?.usuario?.conta_id;
  const currentUsuarioId = me?.usuario?.id;
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
    console.warn("Auditoria não registrada", auditError);
  }
}

export async function removeAvatarFromStorage(supabase, pathOrUrl) {
  const path = getStoragePath(pathOrUrl);
  if (!path) return;

  const { error: removeError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .remove([path]);

  if (removeError) {
    console.warn("Avatar antigo não removido", removeError);
  }
}

export function vehicleName(vehicle) {
  return [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ") || "Veículo sem descrição";
}

// Veículos zero podem não ter placa: usa o chassi (número do vidro) como identificação.
export function vehicleIdentifier(vehicle) {
  return vehicle?.placa || vehicle?.chassi || "";
}
