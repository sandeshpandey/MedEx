import { expect, test } from "vitest";
import { loadExplorer } from "./data/explorer";
import {
  computeFacets,
  filterServices,
  indexServices,
  matches,
} from "./facets";
import { parseFilters } from "./query";
import type { Filters } from "./types";

const data = loadExplorer();
const indexed = indexServices(data.services, data.providers, data.categories);

function f(q = ""): Filters {
  return parseFilters(Object.fromEntries(new URLSearchParams(q)));
}

test("two ultrasound top-level categories keep distinct ids", () => {
  const ultras = data.categories.filter((c) => c.slug === "ultrasound");
  expect(ultras).toHaveLength(2);
  expect(new Set(ultras.map((c) => c.type))).toEqual(new Set(["package", "lab_test"]));
  expect(ultras[0].id).not.toBe(ultras[1].id);
});

test("hides inactive services, inactive providers, and inactive categories", () => {
  const visible = indexed.filter((r) => r.visible);
  expect(visible.every((r) => r.service.status)).toBe(true);
  expect(visible.every((r) => r.provider.status === "active")).toBe(true);
  expect(visible.every((r) => r.category == null || r.category.status)).toBe(true);
  const inactiveProv = data.providers.filter((p) => p.status !== "active");
  expect(inactiveProv.length).toBeGreaterThan(0);
  expect(visible.some((r) => inactiveProv.some((p) => p.id === r.provider.id))).toBe(
    false,
  );
  const noCat = visible.filter((r) => r.service.categoryId == null);
  expect(noCat.length).toBeGreaterThan(0);
});

test("Bangkok facet leaves lab-test count as Bangkok lab tests", () => {
  const bangkok = f("city=bangkok");
  const facets = computeFacets(indexed, bangkok, data.categories);
  const lab = facets.types.find((t) => t.value === "lab_test")!;
  const expected = indexed.filter(
    (r) =>
      matches(r, { ...bangkok, types: ["lab_test"] }),
  ).length;
  expect(lab.count).toBe(expected);
  expect(lab.count).toBeGreaterThan(0);
});

test("facet count ignores its own selected value", () => {
  const withType = f("types=package&city=bangkok");
  const facets = computeFacets(indexed, withType, data.categories);
  const lab = facets.types.find((t) => t.value === "lab_test")!;
  expect(lab.count).toBeGreaterThan(0);
  const filtered = filterServices(indexed, withType);
  expect(filtered.every((r) => r.service.type === "package")).toBe(true);
});

test("price filter requires a currency and never converts", () => {
  const thb = filterServices(indexed, f("currency=THB&max=5000"));
  expect(thb.every((r) => r.currency === "THB")).toBe(true);
  expect(thb.every((r) => r.fromPrice != null && r.fromPrice <= 5000)).toBe(true);
  const mixed = filterServices(indexed, f("max=5000"));
  const currencies = new Set(mixed.map((r) => r.currency));
  expect(currencies.size).toBeGreaterThan(1);
});

test("filtering 3200 services stays under 100ms", () => {
  const filters = f("q=health&types=package,lab_test&city=bangkok&currency=THB&max=8000");
  const t0 = performance.now();
  filterServices(indexed, filters);
  computeFacets(indexed, filters, data.categories);
  const ms = performance.now() - t0;
  expect(ms).toBeLessThan(100);
});
