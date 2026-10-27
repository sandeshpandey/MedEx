"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import {
  computeFacets,
  filterServices,
  groupByProvider,
  indexServices,
} from "@/lib/facets";
import { parseFilters, searchHref } from "@/lib/query";
import type { Category, Filters, Provider, RawService } from "@/lib/types";
import { FiltersForm, SortSelect } from "./FiltersForm";
import { ProviderCard } from "./ProviderCard";

type Payload = {
  categories: Category[];
  providers: Provider[];
  services: RawService[];
};

function Skeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-[var(--line)]" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--line)]" />
        ))}
      </div>
    </div>
  );
}

export function Explorer() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(
    () => parseFilters(Object.fromEntries(sp.entries())),
    [sp],
  );

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [drawer, setDrawer] = useState<Filters | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  async function load() {
    setError(null);
    setData(null);
    try {
      const [c, p, s] = await Promise.all([
        api<{ categories: Category[] }>("/api/categories"),
        api<{ providers: Provider[] }>("/api/providers"),
        api<{ services: RawService[] }>("/api/services"),
      ]);
      setData({
        categories: c.categories,
        providers: p.providers,
        services: s.services,
      });
    } catch (e) {
      setError(e instanceof ApiError ? "Could not load services." : "Could not load services.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const indexed = useMemo(
    () =>
      data
        ? indexServices(data.services, data.providers, data.categories)
        : [],
    [data],
  );

  const activeFilters = drawer ?? filters;
  const matched = useMemo(
    () => filterServices(indexed, activeFilters),
    [indexed, activeFilters],
  );
  const facets = useMemo(
    () =>
      data ? computeFacets(indexed, activeFilters, data.categories) : null,
    [data, indexed, activeFilters],
  );
  const grouped = useMemo(
    () => groupByProvider(filterServices(indexed, filters), filters),
    [indexed, filters],
  );

  function apply(next: Filters) {
    const href = searchHref(next);
    const url = href.startsWith(pathname) ? href : href;
    router.replace(url, { scroll: false });
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (drawer) {
      if (!el.open) el.showModal();
    } else if (el.open) el.close();
  }, [drawer]);

  const pendingCount = drawer ? matched.length : grouped.totalServices;

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Find a service</h1>
          <p className="text-sm text-[var(--muted)]">
            Results are grouped by clinic. Prices stay in the provider’s currency.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SortSelect
            value={filters.sort}
            onChange={(sort) => apply({ ...filters, sort, page: 1 })}
          />
          <button
            type="button"
            className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm lg:hidden"
            onClick={() => setDrawer(filters)}
          >
            Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[var(--danger)] bg-white p-4">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      {!data && !error ? <Skeleton /> : null}

      {data && facets ? (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="hidden lg:block">
            <FiltersForm
              value={filters}
              onChange={apply}
              facets={computeFacets(indexed, filters, data.categories)}
              providerQuery={providerQuery}
              onProviderQuery={setProviderQuery}
            />
          </aside>
          <section>
            <p className="mb-3 text-sm text-[var(--muted)]" aria-live="polite">
              {grouped.totalServices} services from {grouped.totalProviders} providers
            </p>
            {grouped.groups.length === 0 ? (
              <div className="rounded-xl border border-[var(--line)] bg-white p-6">
                <p>No services match these filters.</p>
                {filters.currency || filters.minPrice != null || filters.maxPrice != null ? (
                  <button
                    type="button"
                    className="mt-3 text-[var(--accent)] underline"
                    onClick={() =>
                      apply({
                        ...filters,
                        currency: null,
                        minPrice: null,
                        maxPrice: null,
                      })
                    }
                  >
                    Remove the price filter
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mt-3 text-[var(--accent)] underline"
                    onClick={() => apply(parseFilters({}))}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.groups.map((g) => (
                  <ProviderCard key={g.provider.id} group={g} />
                ))}
              </div>
            )}
            {grouped.pages > 1 ? (
              <nav className="mt-6 flex flex-wrap gap-2" aria-label="Pagination">
                {Array.from({ length: grouped.pages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rounded border px-3 py-1 text-sm ${
                      n === Math.min(filters.page, grouped.pages)
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--line)] bg-white"
                    }`}
                    onClick={() => apply({ ...filters, page: n })}
                    aria-current={n === filters.page ? "page" : undefined}
                  >
                    {n}
                  </button>
                ))}
              </nav>
            ) : null}
          </section>
        </div>
      ) : null}

      <dialog
        ref={dialog}
        className="w-[min(100%,24rem)] rounded-xl p-0"
        onClose={() => setDrawer(null)}
      >
        {drawer && data && facets ? (
          <form
            className="flex max-h-[90vh] flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              apply(drawer);
              setDrawer(null);
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <strong>Filters</strong>
              <button type="button" onClick={() => setDrawer(null)}>
                Close
              </button>
            </div>
            <div className="overflow-auto p-4">
              <FiltersForm
                value={drawer}
                onChange={setDrawer}
                facets={facets}
                providerQuery={providerQuery}
                onProviderQuery={setProviderQuery}
              />
            </div>
            <div className="border-t border-[var(--line)] p-4">
              <button
                type="submit"
                className="w-full rounded bg-[var(--accent)] px-3 py-2 text-white"
              >
                Show {pendingCount} results
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </main>
  );
}
