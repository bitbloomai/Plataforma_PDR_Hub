import { formatDisplayMoney } from "@/lib/currency";

/**
 * src/lib/formatters.js
 *
 * Formatadores de exibiÃ§Ã£o para sistemas Brasil + ItÃ¡lia.
 * Use este arquivo para mostrar dados formatados na interface.
 */

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();

  // Aceita YYYY-MM-DD sem sofrer com deslocamento de timezone
  const isoDateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  }

  // Aceita DD/MM/YYYY
  const brDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brDate) {
    const [, day, month, year] = brDate;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );
  }

  const parsed = new Date(str);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function configLocale(config) {
  return config?.locale || "it-IT";
}

function configTimezone(config) {
  return config?.timezone || "Europe/Rome";
}

function configDateFormat(config) {
  return config?.formato_data || "DD/MM/YYYY";
}

function dateParts(value, config) {
  const date = normalizeDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: configTimezone(config),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    day: parts.day,
    month: parts.month,
    year: parts.year,
  };
}


/* =========================================================
   DATAS
========================================================= */

export function formatDateBR(value) {
  const date = normalizeDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}


export function formatDateIT(value) {
  const date = normalizeDate(value);

  if (!date) return "";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}


export function formatDate(value, country = "BR") {
  return country === "IT"
    ? formatDateIT(value)
    : formatDateBR(value);
}

export function formatDateByConfig(value, config) {
  const parts = dateParts(value, config);
  if (!parts) return "";

  if (configDateFormat(config) === "YYYY-MM-DD") {
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  if (configDateFormat(config) === "MM/DD/YYYY") {
    return `${parts.month}/${parts.day}/${parts.year}`;
  }

  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTimeByConfig(value, config) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat(configLocale(config), {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: configTimezone(config),
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatMoneyByConfig(value, config) {
  if (value === null || value === undefined || value === "") return "";
  return formatDisplayMoney(value, config);
}

/* =========================================================
   MOEDAS
========================================================= */

export function formatEuro(value, locale = "it-IT") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const number =
    typeof value === "number"
      ? value
      : Number(
          String(value)
            .trim()
            .replace(/[â‚¬\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );

  if (!Number.isFinite(number)) return "";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}


export function formatBRL(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const number =
    typeof value === "number"
      ? value
      : Number(
          String(value)
            .trim()
            .replace(/[R$\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );

  if (!Number.isFinite(number)) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}


/* =========================================================
   DOCUMENTOS BRASIL
========================================================= */

export function formatCPF(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length !== 11) return digits;

  return digits.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );
}


export function formatCNPJ(value) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length !== 14) return digits;

  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}


/* =========================================================
   DOCUMENTOS ITÃLIA
========================================================= */

/**
 * Codice Fiscale
 *
 * Possui 16 caracteres alfanumÃ©ricos.
 * Normalmente nÃ£o usa pontuaÃ§Ã£o.
 */
export function formatCodiceFiscale(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}


/**
 * Partita IVA
 *
 * Documento fiscal de empresa italiana.
 * Possui 11 dÃ­gitos.
 */
export function formatPartitaIVA(value) {
  return onlyDigits(value).slice(0, 11);
}


/* =========================================================
   ENDEREÃ‡O
========================================================= */

export function formatCEP(value) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}


/**
 * CAP italiano
 *
 * CÃ³digo postal italiano.
 * Possui 5 dÃ­gitos.
 */
export function formatCAP(value) {
  return onlyDigits(value).slice(0, 5);
}


/* =========================================================
   TELEFONES BRASIL
========================================================= */

export function formatPhoneBR(value) {
  const digits = onlyDigits(value)
    .replace(/^55/, "")
    .slice(0, 11);

  if (!digits) return "";

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(
      2,
      6
    )}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(
    2,
    7
  )}-${digits.slice(7)}`;
}


export function formatPhoneBRInternational(value) {
  const digits = onlyDigits(value)
    .replace(/^55/, "")
    .slice(0, 11);

  if (!digits) return "";

  return `+55 ${formatPhoneBR(digits)}`;
}


/* =========================================================
   TELEFONES ITÃLIA
========================================================= */

/**
 * Telefones italianos possuem comprimentos variÃ¡veis.
 *
 * Celulares normalmente comeÃ§am com 3.
 *
 * Exemplos:
 * +39 347 123 4567
 * +39 02 1234 5678
 */
export function formatPhoneIT(value) {
  let digits = onlyDigits(value);

  if (digits.startsWith("39")) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 11);

  if (!digits) return "";

  // Celular italiano
  if (digits.startsWith("3")) {
    if (digits.length <= 3) {
      return `+39 ${digits}`;
    }

    if (digits.length <= 6) {
      return `+39 ${digits.slice(
        0,
        3
      )} ${digits.slice(3)}`;
    }

    return `+39 ${digits.slice(
      0,
      3
    )} ${digits.slice(
      3,
      6
    )} ${digits.slice(6)}`;
  }

  // Telefone fixo
  if (digits.length <= 2) {
    return `+39 ${digits}`;
  }

  if (digits.length <= 6) {
    return `+39 ${digits.slice(
      0,
      2
    )} ${digits.slice(2)}`;
  }

  return `+39 ${digits.slice(
    0,
    2
  )} ${digits.slice(
    2,
    6
  )} ${digits.slice(6)}`;
}


/* =========================================================
   FORMATADORES GENÃ‰RICOS POR PAÃS
========================================================= */

export function formatPhone(
  value,
  country = "BR"
) {
  return country === "IT"
    ? formatPhoneIT(value)
    : formatPhoneBR(value);
}


export function formatPersonDocument(
  value,
  country = "BR"
) {
  return country === "IT"
    ? formatCodiceFiscale(value)
    : formatCPF(value);
}


export function formatBusinessDocument(
  value,
  country = "BR"
) {
  return country === "IT"
    ? formatPartitaIVA(value)
    : formatCNPJ(value);
}


export function formatPostalCode(
  value,
  country = "BR"
) {
  return country === "IT"
    ? formatCAP(value)
    : formatCEP(value);
}

