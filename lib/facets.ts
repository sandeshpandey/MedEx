import { finalPrice, wellnessFromPrice } from "./pricing";
import type {
  Category,
  Currency,
  Filters,
  Provider,
  RawService,
  ServiceType,
  SortKey,
} from "./types";
import { PAGE_SIZE } from "./types";

export function flattenCategories(categories: Category[]): Category[] {
  const out: Category[] = [];
  for (const c of categories) {
    out.push(c);
    for (const ch of c.children ?? []) out.push(ch);
  }
  return out;
}

export type IndexedService = {
  service: RawService;
  provider: Provider;
  currency: Currency;
  category: Category | null;
  subcategory: Category | null;
  visible: boolean;
  unitPrice: number | null;
  fromPrice: number | null;
  searchHay: string;
};

export type FacetOption = {
  value: string;
  label: string;
  count: number;
};

export type Facets = {
  types: FacetOption[];
  categories: FacetOption[];
  subcategories: FacetOption[];
  providers: FacetOption[];
  cities: FacetOption[];
  countries: FacetOption[];
  homeTest: number;
};

export type ProviderGroup = {
  provider: Provider;
  services: IndexedService[];
  total: number;
};

const TYPE_LABEL: Record<ServiceType, string> = {
  package: "Package",
  lab_test: "Lab test",
  wellness: "Wellness",
  service: "Service",
  insurance: "Insurance",
  unknown: "Unavailable",
};

export function indexServices(
  services: RawService[],
  providers: Provider[],
  categories: Category[],
): IndexedService[] {
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const catById = new Map(flattenCategories(categories).map((c) => [c.id, c]));
  return services.map((service) => {
    const provider = providerById.get(service.userId);
    const category = service.categoryId ? (catById.get(service.categoryId) ?? null) : null;
    const subcategory = service.subCategoryId
      ? (catById.get(service.subCategoryId) ?? null)
      : null;
    const currency = (provider?.providerInformation.currency ?? "THB") as Currency;
    const visible = Boolean(
      service.status &&
        provider?.status === "active" &&
        (category == null || category.status),
    );
    const unitPrice = service.type === "wellness" ? null : finalPrice(service);
    const fromPrice =
      service.type === "wellness" ? wellnessFromPrice(service.wellnessPricing) : unitPrice;
    const searchHay = [
      service.title,
      provider?.name ?? "",
      category?.title ?? "",
      subcategory?.title ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return {
      service,
      provider: provider!,
      currency,
      category,
      subcategory,
      visible,
      unitPrice,
      fromPrice,
      searchHay,
    };
  });
}

type Skip =
  | "types"
  | "category"
  | "sub"
  | "providers"
  | "place"
  | "price"
  | "home";

export function matches(
  row: IndexedService,
  f: Filters,
  skip?: Skip,
): boolean {
  if (!row.visible) return false;
  if (f.q && !row.searchHay.includes(f.q.toLowerCase())) return false;
  if (skip !== "types" && f.types.length && !f.types.includes(row.service.type)) {
    return false;
  }
  if (skip !== "category") {
    if (f.categoryId && row.service.categoryId !== f.categoryId) return false;
    if (skip !== "sub" && f.subCategoryId && row.service.subCategoryId !== f.subCategoryId) {
      return false;
    }
  }
  if (
    skip !== "providers" &&
    f.providerIds.length &&
    !f.providerIds.includes(row.service.userId)
  ) {
    return false;
  }
  if (skip !== "place") {
    const city = row.provider.providerInformation.city?.slug;
    const country = row.provider.providerInformation.country?.alphaCode;
    if (f.city && city !== f.city) return false;
    if (f.country && country !== f.country) return false;
  }
  if (skip !== "price" && f.currency) {
    if (row.currency !== f.currency) return false;
    if (f.minPrice != null || f.maxPrice != null) {
      if (row.fromPrice == null) return false;
      if (f.minPrice != null && row.fromPrice < f.minPrice) return false;
      if (f.maxPrice != null && row.fromPrice > f.maxPrice) return false;
    }
  }
  if (skip !== "home" && f.homeTest != null && row.service.testAtHome !== f.homeTest) {
    return false;
  }
  return true;
}

export function filterServices(rows: IndexedService[], f: Filters): IndexedService[] {
  return rows.filter((r) => matches(r, f));
}

function countBy(
  rows: IndexedService[],
  f: Filters,
  skip: Skip,
  key: (r: IndexedService) => string | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!matches(r, f, skip)) continue;
    const k = key(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export function computeFacets(
  rows: IndexedService[],
  f: Filters,
  categories: Category[],
): Facets {
  const typeCounts = countBy(rows, f, "types", (r) => r.service.type);
  const catCounts = countBy(rows, f, "category", (r) => r.service.categoryId);
  const subCounts = countBy(rows, f, "sub", (r) => r.service.subCategoryId);
  const provCounts = countBy(rows, f, "providers", (r) => String(r.service.userId));
  const cityCounts = countBy(
    rows,
    f,
    "place",
    (r) => r.provider.providerInformation.city?.slug ?? null,
  );
  const countryCounts = countBy(
    rows,
    f,
    "place",
    (r) => r.provider.providerInformation.country?.alphaCode ?? null,
  );
  let homeTest = 0;
  for (const r of rows) {
    if (matches(r, f, "home") && r.service.testAtHome) homeTest += 1;
  }

  const types: ServiceType[] = [
    "package",
    "lab_test",
    "wellness",
    "service",
    "insurance",
  ];
  const cities = new Map<string, string>();
  const countries = new Map<string, string>();
  const providers = new Map<string, string>();
  for (const r of rows) {
    if (!r.visible) continue;
    const city = r.provider.providerInformation.city;
    const country = r.provider.providerInformation.country;
    if (city) cities.set(city.slug, city.name);
    if (country) countries.set(country.alphaCode, country.name);
    providers.set(String(r.provider.id), r.provider.name);
  }

  const topCats = categories.filter((c) => c.status);
  const selected = topCats.find((c) => c.id === f.categoryId);

  return {
    types: types.map((t) => ({
      value: t,
      label: TYPE_LABEL[t],
      count: typeCounts.get(t) ?? 0,
    })),
    categories: topCats.map((c) => ({
      value: c.id,
      label: `${c.title} (${TYPE_LABEL[c.type]})`,
      count: catCounts.get(c.id) ?? 0,
    })),
    subcategories: (selected?.children ?? []).map((c) => ({
      value: c.id,
      label: c.title,
      count: subCounts.get(c.id) ?? 0,
    })),
    providers: [...providers.entries()]
      .map(([value, label]) => ({
        value,
        label,
        count: provCounts.get(value) ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    cities: [...cities.entries()]
      .map(([value, label]) => ({
        value,
        label,
        count: cityCounts.get(value) ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    countries: [...countries.entries()]
      .map(([value, label]) => ({
        value,
        label,
        count: countryCounts.get(value) ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    homeTest,
  };
}

function relevance(row: IndexedService, q: string): number {
  let score = 0;
  const t = row.service.title.toLowerCase();
  const p = row.provider.name.toLowerCase();
  const c = (row.category?.title ?? "").toLowerCase();
  if (q) {
    if (t.startsWith(q)) score += 8;
    else if (t.includes(q)) score += 5;
    if (p.includes(q)) score += 3;
    if (c.includes(q)) score += 1;
  }
  score += (row.provider.providerInformation.rating ?? 0) * 0.5;
  score += Date.parse(row.service.createdAt) / 1e12;
  return score;
}

function sortRows(rows: IndexedService[], f: Filters): IndexedService[] {
  const q = f.q.toLowerCase();
  const copy = rows.slice();
  copy.sort((a, b) => compareRow(a, b, f.sort, q, f.currency));
  return copy;
}

function compareRow(
  a: IndexedService,
  b: IndexedService,
  sort: SortKey,
  q: string,
  currency: Currency | null,
): number {
  if (sort === "rating") {
    const ra = a.provider.providerInformation.rating;
    const rb = b.provider.providerInformation.rating;
    if (ra == null && rb != null) return 1;
    if (rb == null && ra != null) return -1;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    return relevance(b, q) - relevance(a, q);
  }
  if (sort === "price_asc" || sort === "price_desc") {
    const dir = sort === "price_asc" ? 1 : -1;
    const rank = (r: IndexedService) => {
      if (currency && r.currency !== currency) return 2;
      if (r.fromPrice == null) return 1;
      return 0;
    };
    const d = rank(a) - rank(b);
    if (d) return d;
    if (a.fromPrice != null && b.fromPrice != null && a.fromPrice !== b.fromPrice) {
      return (a.fromPrice - b.fromPrice) * dir;
    }
    return relevance(b, q) - relevance(a, q);
  }
  return relevance(b, q) - relevance(a, q);
}

function providerRank(services: IndexedService[], f: Filters): number {
  if (!services.length) return Number.POSITIVE_INFINITY;
  const q = f.q.toLowerCase();
  if (f.sort === "rating") {
    const r = services[0].provider.providerInformation.rating;
    return r == null ? 999 : -r;
  }
  if (f.sort === "price_asc" || f.sort === "price_desc") {
    const priced = services.filter(
      (s) => s.fromPrice != null && (!f.currency || s.currency === f.currency),
    );
    if (!priced.length) return 1e12;
    const prices = priced.map((s) => s.fromPrice!);
    return f.sort === "price_asc" ? Math.min(...prices) : -Math.max(...prices);
  }
  return -Math.max(...services.map((s) => relevance(s, q)));
}

export function groupByProvider(
  rows: IndexedService[],
  f: Filters,
): { groups: ProviderGroup[]; totalServices: number; totalProviders: number; pages: number } {
  const sorted = sortRows(rows, f);
  const map = new Map<number, IndexedService[]>();
  for (const row of sorted) {
    const list = map.get(row.provider.id);
    if (list) list.push(row);
    else map.set(row.provider.id, [row]);
  }
  const groups: ProviderGroup[] = [...map.values()].map((services) => ({
    provider: services[0].provider,
    services,
    total: services.length,
  }));
  groups.sort((a, b) => {
    const d = providerRank(a.services, f) - providerRank(b.services, f);
    if (d) return d;
    return a.provider.name.localeCompare(b.provider.name);
  });
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  const start = (page - 1) * PAGE_SIZE;
  return {
    groups: groups.slice(start, start + PAGE_SIZE),
    totalServices: rows.length,
    totalProviders: groups.length,
    pages,
  };
}

export { TYPE_LABEL };
