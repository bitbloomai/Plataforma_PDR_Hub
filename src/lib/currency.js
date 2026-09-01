export const BASE_CURRENCY = "EUR";

export const CURRENCY_OPTIONS = [
  { value: "EUR", symbol: "\u20AC", label: "\u20AC EUR - Euro" },
  { value: "BRL", symbol: "R$", label: "R$ BRL - Real brasileiro" },
  { value: "USD", symbol: "$", label: "$ USD - Dolar americano" },
  { value: "ARS", symbol: "$", label: "$ ARS - Peso argentino" },
  { value: "CAD", symbol: "$", label: "$ CAD - Dolar canadense" },
  { value: "MXN", symbol: "$", label: "$ MXN - Peso mexicano" },
  { value: "CHF", symbol: "CHF", label: "CHF - Franco suico" },
  { value: "GBP", symbol: "\u00A3", label: "\u00A3 GBP - Libra esterlina" },
  { value: "AUD", symbol: "$", label: "$ AUD - Dolar australiano" },
  { value: "JPY", symbol: "\u00A5", label: "\u00A5 JPY - Iene japones" },
  { value: "CLP", symbol: "$", label: "$ CLP - Peso chileno" },
];

export const LOCALE_OPTIONS = [
  { value: "it-IT", label: "\uD83C\uDDEE\uD83C\uDDF9 Italia - Italiano", timezone: "Europe/Rome", dateFormat: "DD/MM/YYYY" },
  { value: "pt-BR", label: "\uD83C\uDDE7\uD83C\uDDF7 Brasil - Portugues", timezone: "America/Sao_Paulo", dateFormat: "DD/MM/YYYY" },
  { value: "en-US", label: "\uD83C\uDDFA\uD83C\uDDF8 Estados Unidos - English", timezone: "America/Chicago", dateFormat: "MM/DD/YYYY" },
  { value: "es-AR", label: "\uD83C\uDDE6\uD83C\uDDF7 Argentina - Espanol", timezone: "America/Argentina/Buenos_Aires", dateFormat: "DD/MM/YYYY" },
  { value: "en-CA", label: "\uD83C\uDDE8\uD83C\uDDE6 Canada - English", timezone: "America/Toronto", dateFormat: "YYYY-MM-DD" },
  { value: "fr-CA", label: "\uD83C\uDDE8\uD83C\uDDE6 Canada - Francais", timezone: "America/Toronto", dateFormat: "YYYY-MM-DD" },
  { value: "de-DE", label: "\uD83C\uDDE9\uD83C\uDDEA Alemanha - Deutsch", timezone: "Europe/Berlin", dateFormat: "DD/MM/YYYY" },
  { value: "fr-FR", label: "\uD83C\uDDEB\uD83C\uDDF7 Franca - Francais", timezone: "Europe/Paris", dateFormat: "DD/MM/YYYY" },
  { value: "es-ES", label: "\uD83C\uDDEA\uD83C\uDDF8 Espanha - Espanol", timezone: "Europe/Madrid", dateFormat: "DD/MM/YYYY" },
  { value: "en-GB", label: "\uD83C\uDDEC\uD83C\uDDE7 Reino Unido - English", timezone: "Europe/London", dateFormat: "DD/MM/YYYY" },
  { value: "es-MX", label: "\uD83C\uDDF2\uD83C\uDDFD Mexico - Espanol", timezone: "America/Mexico_City", dateFormat: "DD/MM/YYYY" },
  { value: "de-CH", label: "\uD83C\uDDE8\uD83C\uDDED Suica - Deutsch", timezone: "Europe/Zurich", dateFormat: "DD/MM/YYYY" },
  { value: "en-AU", label: "\uD83C\uDDE6\uD83C\uDDFA Australia - English", timezone: "Australia/Sydney", dateFormat: "DD/MM/YYYY" },
  { value: "es-CL", label: "\uD83C\uDDE8\uD83C\uDDF1 Chile - Espanol", timezone: "America/Santiago", dateFormat: "DD/MM/YYYY" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Europe/Rome", label: "Europe/Rome - Italia" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo - Brasil" },
  { value: "America/Chicago", label: "America/Chicago - Estados Unidos" },
  { value: "America/New_York", label: "America/New_York - Estados Unidos" },
  { value: "America/Denver", label: "America/Denver - Estados Unidos" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires - Argentina" },
  { value: "America/Toronto", label: "America/Toronto - Canada" },
  { value: "America/Mexico_City", label: "America/Mexico_City - Mexico" },
  { value: "America/Santiago", label: "America/Santiago - Chile" },
  { value: "Europe/Berlin", label: "Europe/Berlin - Alemanha" },
  { value: "Europe/Paris", label: "Europe/Paris - Franca" },
  { value: "Europe/Madrid", label: "Europe/Madrid - Espanha" },
  { value: "Europe/London", label: "Europe/London - Reino Unido" },
  { value: "Europe/Zurich", label: "Europe/Zurich - Suica" },
  { value: "Australia/Sydney", label: "Australia/Sydney - Australia" },
  { value: "UTC", label: "UTC" },
];

const SUPPORTED = new Set(CURRENCY_OPTIONS.map((option) => option.value));
const rateCache = new Map();
const RATE_TTL = 60 * 60 * 1000;

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeCurrency(value) {
  const currency = String(value || BASE_CURRENCY).toUpperCase();
  return SUPPORTED.has(currency) ? currency : BASE_CURRENCY;
}

export function localeDefaults(locale) {
  return LOCALE_OPTIONS.find((option) => option.value === locale) || LOCALE_OPTIONS[0];
}

export function currencyRate(config, currency) {
  const normalized = normalizeCurrency(currency);
  const rate = Number(config?.cambio?.rates?.[normalized] ?? (normalized === BASE_CURRENCY ? 1 : 0));
  return Number.isFinite(rate) && rate > 0 ? rate : normalized === BASE_CURRENCY ? 1 : 0;
}

export function convertMoney(value, fromCurrency, toCurrency, config) {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return safeNumber(value);

  const fromRate = currencyRate(config, from);
  const toRate = currencyRate(config, to);
  if (!fromRate || !toRate) return safeNumber(value);

  return (safeNumber(value) / fromRate) * toRate;
}

export function moneyFromStorage(value, config, sourceCurrency) {
  return convertMoney(value, sourceCurrency || config?.moeda_original || BASE_CURRENCY, config?.moeda, config);
}

export function moneyToStorage(value) {
  return safeNumber(value);
}

export function roundMoney(value) {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
}

export function formatDisplayMoney(value, config) {
  const currency = normalizeCurrency(config?.moeda);
  const locale = config?.locale || "it-IT";
  const converted = moneyFromStorage(value, config, config?.moeda_original);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  } catch {
    return `${currency} ${converted.toFixed(2)}`;
  }
}

export function withSourceCurrency(config, sourceCurrency) {
  return { ...(config || {}), moeda_original: normalizeCurrency(sourceCurrency || BASE_CURRENCY) };
}

export async function fetchLatestExchangeRates() {
  const quotes = CURRENCY_OPTIONS.map((option) => option.value).filter((currency) => currency !== BASE_CURRENCY);
  const cacheKey = quotes.join(",");
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < RATE_TTL) return cached.data;

  const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${BASE_CURRENCY}&quotes=${quotes.join(",")}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error("Cambio indisponivel.");
  const payload = await response.json();
  const rates = { EUR: 1 };
  const rows = Array.isArray(payload) ? payload : payload?.rates;

  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const quote = normalizeCurrency(row?.quote);
      const rate = Number(row?.rate);
      if (SUPPORTED.has(quote) && Number.isFinite(rate) && rate > 0) rates[quote] = rate;
    });
  } else if (rows && typeof rows === "object") {
    Object.entries(rows).forEach(([quote, rateValue]) => {
      const normalized = normalizeCurrency(quote);
      const rate = Number(rateValue);
      if (SUPPORTED.has(normalized) && Number.isFinite(rate) && rate > 0) rates[normalized] = rate;
    });
  }

  const data = {
    base: payload?.base || BASE_CURRENCY,
    quote: "ALL",
    rates,
    date: Array.isArray(rows) ? rows[0]?.date || null : payload?.date || null,
    provider: "frankfurter",
  };
  rateCache.set(cacheKey, { savedAt: Date.now(), data });
  return data;
}
