import type { FacetOption, Facets } from "@/lib/facets";
import type { Currency, Filters, SortKey } from "@/lib/types";

function OptionList({
  legend,
  options,
  selected,
  onToggle,
  name,
}: {
  legend: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string, on: boolean) => void;
  name: string;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-semibold">{legend}</legend>
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = o.count === 0 && !on;
        return (
          <label
            key={o.value}
            className={`flex items-center gap-2 text-sm ${disabled ? "text-[var(--disabled)]" : ""}`}
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={on}
              disabled={disabled}
              onChange={(e) => onToggle(o.value, e.target.checked)}
            />
            <span className="flex-1">{o.label}</span>
            <span className="tabular-nums text-[var(--muted)]">{o.count}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function FiltersForm({
  value,
  onChange,
  facets,
  providerQuery,
  onProviderQuery,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  facets: Facets;
  providerQuery: string;
  onProviderQuery: (q: string) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 1 });
  const providers = facets.providers.filter((p) =>
    p.label.toLowerCase().includes(providerQuery.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <label className="block text-sm">
        <span className="font-semibold">Search</span>
        <input
          type="search"
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Title, provider or category"
          className="mt-1 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5"
        />
      </label>

      <OptionList
        legend="Service type"
        name="types"
        options={facets.types}
        selected={value.types}
        onToggle={(v, on) =>
          set({
            types: on ? [...value.types, v as Filters["types"][number]] : value.types.filter((t) => t !== v),
          })
        }
      />

      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">Category</legend>
        <div className="space-y-1">
          {facets.categories.map((o) => {
            const on = value.categoryId === o.value;
            const disabled = o.count === 0 && !on;
            return (
              <label
                key={o.value}
                className={`flex items-center gap-2 text-sm ${disabled ? "text-[var(--disabled)]" : ""}`}
              >
                <input
                  type="radio"
                  name="cat"
                  checked={on}
                  disabled={disabled}
                  onChange={() => set({ categoryId: o.value, subCategoryId: null })}
                />
                <span className="flex-1">{o.label}</span>
                <span className="tabular-nums text-[var(--muted)]">{o.count}</span>
              </label>
            );
          })}
        </div>
        {value.categoryId ? (
          <button
            type="button"
            className="text-sm text-[var(--accent)] underline"
            onClick={() => set({ categoryId: null, subCategoryId: null })}
          >
            Clear category
          </button>
        ) : null}
      </fieldset>

      {facets.subcategories.length > 0 ? (
        <OptionList
          legend="Subcategory"
          name="sub"
          options={facets.subcategories}
          selected={value.subCategoryId ? [value.subCategoryId] : []}
          onToggle={(v, on) => set({ subCategoryId: on ? v : null })}
        />
      ) : null}

      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">Provider</legend>
        <input
          type="search"
          value={providerQuery}
          onChange={(e) => onProviderQuery(e.target.value)}
          placeholder="Search providers"
          className="mb-1 w-full rounded border border-[var(--line)] px-2 py-1.5 text-sm"
        />
        <div className="max-h-48 overflow-auto pr-1">
          {providers.map((o) => {
            const on = value.providerIds.includes(Number(o.value));
            const disabled = o.count === 0 && !on;
            return (
              <label
                key={o.value}
                className={`flex items-center gap-2 text-sm ${disabled ? "text-[var(--disabled)]" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => {
                    const id = Number(o.value);
                    set({
                      providerIds: e.target.checked
                        ? [...value.providerIds, id]
                        : value.providerIds.filter((x) => x !== id),
                    });
                  }}
                />
                <span className="flex-1">{o.label}</span>
                <span className="tabular-nums text-[var(--muted)]">{o.count}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">City</legend>
        {facets.cities.map((o) => {
          const on = value.city === o.value;
          const disabled = o.count === 0 && !on;
          return (
            <label
              key={o.value}
              className={`flex items-center gap-2 text-sm ${disabled ? "text-[var(--disabled)]" : ""}`}
            >
              <input
                type="radio"
                name="city"
                checked={on}
                disabled={disabled}
                onChange={() => set({ city: o.value, country: null })}
              />
              <span className="flex-1">{o.label}</span>
              <span className="tabular-nums text-[var(--muted)]">{o.count}</span>
            </label>
          );
        })}
        {value.city ? (
          <button type="button" className="text-sm text-[var(--accent)] underline" onClick={() => set({ city: null })}>
            Clear city
          </button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">Country</legend>
        {facets.countries.map((o) => {
          const on = value.country === o.value;
          const disabled = o.count === 0 && !on;
          return (
            <label
              key={o.value}
              className={`flex items-center gap-2 text-sm ${disabled ? "text-[var(--disabled)]" : ""}`}
            >
              <input
                type="radio"
                name="country"
                checked={on}
                disabled={disabled}
                onChange={() => set({ country: o.value, city: null })}
              />
              <span className="flex-1">{o.label}</span>
              <span className="tabular-nums text-[var(--muted)]">{o.count}</span>
            </label>
          );
        })}
        {value.country ? (
          <button
            type="button"
            className="text-sm text-[var(--accent)] underline"
            onClick={() => set({ country: null })}
          >
            Clear country
          </button>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Price</legend>
        <p className="text-xs text-[var(--muted)]">
          Choose a currency first. We do not convert between THB, NPR and INR.
        </p>
        <label className="block text-sm">
          Currency
          <select
            className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5"
            value={value.currency ?? ""}
            onChange={(e) =>
              set({
                currency: (e.target.value || null) as Currency | null,
                minPrice: e.target.value ? value.minPrice : null,
                maxPrice: e.target.value ? value.maxPrice : null,
              })
            }
          >
            <option value="">All currencies</option>
            <option value="THB">THB</option>
            <option value="NPR">NPR</option>
            <option value="INR">INR</option>
          </select>
        </label>
        {value.currency ? (
          <div className="flex gap-2">
            <label className="flex-1 text-sm">
              Min
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5"
                value={value.minPrice ?? ""}
                onChange={(e) =>
                  set({ minPrice: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </label>
            <label className="flex-1 text-sm">
              Max
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-[var(--line)] px-2 py-1.5"
                value={value.maxPrice ?? ""}
                onChange={(e) =>
                  set({ maxPrice: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.homeTest === true}
          onChange={(e) => set({ homeTest: e.target.checked ? true : null })}
        />
        Available as a home test
        <span className="tabular-nums text-[var(--muted)]">({facets.homeTest})</span>
      </label>
    </div>
  );
}

export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (s: SortKey) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      Sort
      <select
        className="rounded border border-[var(--line)] bg-white px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
      >
        <option value="relevance">Relevance</option>
        <option value="price_asc">Price, low to high</option>
        <option value="price_desc">Price, high to low</option>
        <option value="rating">Rating</option>
      </select>
    </label>
  );
}
