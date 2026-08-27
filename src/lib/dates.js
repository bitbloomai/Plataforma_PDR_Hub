const DEFAULT_TIME_ZONE = "Europe/Rome";

function formatterFor(timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function todayISO(timeZone = DEFAULT_TIME_ZONE) {
  return formatterFor(timeZone).format(new Date());
}

export function localISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDaysISO(dateString, days) {
  const date = parseDateOnly(dateString);
  if (!date) return dateString || null;

  date.setDate(date.getDate() + Math.max(0, Number(days) || 0));
  return localISO(date);
}
