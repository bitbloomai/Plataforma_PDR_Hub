/**
 * src/lib/inputMasks.js
 *
 * Máscaras usadas enquanto o usuário digita.
 *
 * Máscara != validação.
 *
 * A validação real de CPF, Codice Fiscale,
 * Partita IVA etc. deve ficar em validators.js.
 */

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}


/* =========================================================
   DATA
========================================================= */

/**
 * DD/MM/YYYY
 */
export function maskDateBR(value) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(2)}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(4)}`;
}


/**
 * Itália também usa DD/MM/YYYY.
 */
export const maskDateIT = maskDateBR;

export const maskDate = maskDateBR;


/* =========================================================
   EURO
========================================================= */

/**
 * Máscara monetária para EUR.
 *
 * Exemplo:
 *
 * digitado:
 * 123456
 *
 * resultado:
 * 1.234,56
 *
 * Recomendo não colocar o símbolo € dentro
 * do value do input.
 */
export function maskEuro(value) {
  const digits = onlyDigits(value);

  if (!digits) return "";

  const cents = digits.padStart(3, "0");

  const integerPart = cents
    .slice(0, -2)
    .replace(/^0+(?=\d)/, "");

  const decimalPart = cents.slice(-2);

  const formattedInteger =
    integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "."
    );

  return `${formattedInteger || "0"},${decimalPart}`;
}


/**
 * Converte:
 *
 * 1.234,56
 *
 * em:
 *
 * 1234.56
 *
 * Use antes de salvar no banco.
 */
export function euroMaskToNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const normalized = String(value)
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}


/* =========================================================
   CPF
========================================================= */

export function maskCPF(value) {
  let digits = onlyDigits(value).slice(0, 11);

  digits = digits.replace(
    /^(\d{3})(\d)/,
    "$1.$2"
  );

  digits = digits.replace(
    /^(\d{3})\.(\d{3})(\d)/,
    "$1.$2.$3"
  );

  digits = digits.replace(
    /^(\d{3})\.(\d{3})\.(\d{3})(\d)/,
    "$1.$2.$3-$4"
  );

  return digits;
}


/* =========================================================
   CNPJ
========================================================= */

export function maskCNPJ(value) {
  let digits = onlyDigits(value).slice(0, 14);

  digits = digits.replace(
    /^(\d{2})(\d)/,
    "$1.$2"
  );

  digits = digits.replace(
    /^(\d{2})\.(\d{3})(\d)/,
    "$1.$2.$3"
  );

  digits = digits.replace(
    /^(\d{2})\.(\d{3})\.(\d{3})(\d)/,
    "$1.$2.$3/$4"
  );

  digits = digits.replace(
    /^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,
    "$1.$2.$3/$4-$5"
  );

  return digits;
}


/* =========================================================
   CODICE FISCALE ITALIANO
========================================================= */

/**
 * Não possui máscara visual.
 *
 * Apenas:
 * - uppercase
 * - remove caracteres inválidos
 * - limita em 16 caracteres
 */
export function maskCodiceFiscale(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}


/* =========================================================
   PARTITA IVA
========================================================= */

export function maskPartitaIVA(value) {
  return onlyDigits(value).slice(0, 11);
}


/* =========================================================
   CEP BRASILEIRO
========================================================= */

export function maskCEP(value) {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}


/* =========================================================
   CAP ITALIANO
========================================================= */

export function maskCAP(value) {
  return onlyDigits(value).slice(0, 5);
}


/* =========================================================
   TELEFONE BRASIL
========================================================= */

export function maskPhoneBR(value) {
  const digits = onlyDigits(value)
    .replace(/^55/, "")
    .slice(0, 11);

  if (!digits) return "";

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(
      0,
      2
    )}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(
      0,
      2
    )}) ${digits.slice(
      2,
      6
    )}-${digits.slice(6)}`;
  }

  return `(${digits.slice(
    0,
    2
  )}) ${digits.slice(
    2,
    7
  )}-${digits.slice(7)}`;
}


/* =========================================================
   TELEFONE ITÁLIA
========================================================= */

/**
 * Aceita com ou sem +39.
 *
 * Celulares italianos normalmente começam com 3.
 */
export function maskPhoneIT(value) {
  let digits = onlyDigits(value);

  if (digits.startsWith("39")) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 11);

  if (!digits) return "";

  // Celular
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

  // Fixo
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
   MÁSCARAS GENÉRICAS POR PAÍS
========================================================= */

/**
 * Documento de pessoa física.
 *
 * BR = CPF
 * IT = Codice Fiscale
 */
export function maskPersonDocument(
  value,
  country = "BR"
) {
  return country === "IT"
    ? maskCodiceFiscale(value)
    : maskCPF(value);
}


/**
 * Documento empresarial.
 *
 * BR = CNPJ
 * IT = Partita IVA
 */
export function maskBusinessDocument(
  value,
  country = "BR"
) {
  return country === "IT"
    ? maskPartitaIVA(value)
    : maskCNPJ(value);
}


/**
 * Código postal.
 *
 * BR = CEP
 * IT = CAP
 */
export function maskPostalCode(
  value,
  country = "BR"
) {
  return country === "IT"
    ? maskCAP(value)
    : maskCEP(value);
}


/**
 * Telefone.
 *
 * BR ou IT.
 */
export function maskPhone(
  value,
  country = "BR"
) {
  return country === "IT"
    ? maskPhoneIT(value)
    : maskPhoneBR(value);
}


/* =========================================================
   REMOÇÃO DE MÁSCARAS
========================================================= */

/**
 * CPF, CNPJ, CEP, CAP, Partita IVA etc.
 */
export function unmaskDigits(value) {
  return onlyDigits(value);
}


/**
 * Codice Fiscale limpo.
 */
export function unmaskCodiceFiscale(value) {
  return maskCodiceFiscale(value);
}