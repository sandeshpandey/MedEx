import type { Currency, Filters, ServiceType, SortKey } from "./types";

const TYPES: ServiceType[] = [
  "package",
  "lab_test",
  "wellness",
  "service",
  "insurance",
];
const SORTS: SortKey[] = ["relevance", "price_asc", "price_desc", "rating"];
const CURRENCIES: Currency[] = ["THB", "NPR", "INR"];

function one(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const types = one(sp, "types")
    .split(",")
    .filter((t): t is ServiceType => TYPES.includes(t as ServiceType));
  const providerIds = one(sp, "providers")
    .split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
  const currencyRaw = one(sp, "currency");
  const sortRaw = one(sp, "sort");
  const min = Number(one(sp, "min"));
  const max = Number(one(sp, "max"));
  const page = Number(one(sp, "page"));
  const home = one(sp, "home");
  return {
    q: one(sp, "q").trim(),
    types,
    categoryId: one(sp, "cat") || null,
    subCategoryId: one(sp, "sub") || null,
    providerIds,
    city: one(sp, "city") || null,
    country: one(sp, "country") || null,
    currency: CURRENCIES.includes(currencyRaw as Currency)
      ? (currencyRaw as Currency)
      : null,
    minPrice: Number.isFinite(min) && one(sp, "min") !== "" ? min : null,
    maxPrice: Number.isFinite(max) && one(sp, "max") !== "" ? max : null,
    homeTest: home === "1" ? true : home === "0" ? false : null,
    sort: SORTS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "relevance",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.types.length) p.set("types", f.types.join(","));
  if (f.categoryId) p.set("cat", f.categoryId);
  if (f.subCategoryId) p.set("sub", f.subCategoryId);
  if (f.providerIds.length) p.set("providers", f.providerIds.join(","));
  if (f.city) p.set("city", f.city);
  if (f.country) p.set("country", f.country);
  if (f.currency) p.set("currency", f.currency);
  if (f.minPrice != null) p.set("min", String(f.minPrice));
  if (f.maxPrice != null) p.set("max", String(f.maxPrice));
  if (f.homeTest != null) p.set("home", f.homeTest ? "1" : "0");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

export function searchHref(f: Filters): string {
  const q = filtersToParams(f).toString();
  return q ? `/explore?${q}` : "/explore";
}
