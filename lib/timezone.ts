const ALIAS: Record<string, string> = {
  "asia/bangkok": "Asia/Bangkok",
  "asia/kathmandu": "Asia/Kathmandu",
  "asia/katmandu": "Asia/Kathmandu",
  "asia/kolkata": "Asia/Kolkata",
  "asia/calcutta": "Asia/Kolkata",
  "utc+05:45": "Asia/Kathmandu",
  "utc+5:45": "Asia/Kathmandu",
  "+05:45": "Asia/Kathmandu",
  "+5:45": "Asia/Kathmandu",
  "gmt+05:45": "Asia/Kathmandu",
  "gmt+5:45": "Asia/Kathmandu",
  "(gmt+5:45)": "Asia/Kathmandu",
  "(gmt+05:45)": "Asia/Kathmandu",
  "nepal standard time": "Asia/Kathmandu",
  "india standard time": "Asia/Kolkata",
  "indochina time": "Asia/Bangkok",
};

const COUNTRY_TZ: Record<string, string> = {
  TH: "Asia/Bangkok",
  NP: "Asia/Kathmandu",
  IN: "Asia/Kolkata",
};

function key(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function isIana(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export type ResolvedZone = {
  iana: string;
  source: "iana" | "alias" | "country";
  original: string;
};

export function resolveTimeZone(raw: string, country?: string): ResolvedZone {
  const original = raw;
  const k = key(raw);
  if (k && ALIAS[k]) return { iana: ALIAS[k], source: "alias", original };
  const trimmed = raw.trim();
  if (trimmed && isIana(trimmed)) return { iana: trimmed, source: "iana", original };
  const fallback = COUNTRY_TZ[country ?? ""] ?? "UTC";
  return { iana: fallback, source: "country", original };
}

export function ymdInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function diffDays(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function partsUtc(date: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
}

export function wallToUtc(
  ymd: string,
  hhmm: string,
  timeZone: string,
): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset = partsUtc(new Date(guess), timeZone) - guess;
  return new Date(guess - offset);
}

export function weekdayLong(ymd: string, timeZone: string): string {
  const noon = wallToUtc(ymd, "12:00", timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  })
    .format(noon)
    .toLowerCase();
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDate(ymd: string, timeZone: string): string {
  const noon = wallToUtc(ymd, "12:00", timeZone);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(noon);
}
