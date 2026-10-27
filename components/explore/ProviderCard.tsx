import { useState } from "react";
import { TYPE_LABEL, type IndexedService, type ProviderGroup } from "@/lib/facets";
import { displayMoney, hasDiscount, originalPrice } from "@/lib/pricing";

function Price({ row }: { row: IndexedService }) {
  const currency = row.currency;
  if (row.service.type === "wellness") {
    if (row.fromPrice == null) return <span>Price on request</span>;
    return (
      <span>
        From {displayMoney(row.fromPrice, currency)}
        <span className="block text-xs text-[var(--muted)]">Depends on duration</span>
      </span>
    );
  }
  if (row.unitPrice == null) return <span>Price on request</span>;
  const original = originalPrice(row.service);
  const discounted = hasDiscount(row.service) && original != null && original > row.unitPrice;
  return (
    <span>
      {discounted ? (
        <s className="mr-2 font-normal text-[var(--muted)] line-through">
          {displayMoney(original, currency)}
        </s>
      ) : null}
      {displayMoney(row.unitPrice, currency)}
    </span>
  );
}

function ServiceRow({ row }: { row: IndexedService }) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-[var(--line)] py-3">
      <div>
        <p className="font-medium">{row.service.title}</p>
        <p className="text-sm text-[var(--muted)]">
          {TYPE_LABEL[row.service.type]}
          {row.category ? ` · ${row.category.title}` : ""}
          {row.subcategory ? ` / ${row.subcategory.title}` : ""}
        </p>
        {row.service.testAtHome ? (
          <p className="text-xs text-[var(--muted)]">
            Home test available
            {row.service.homeTestCharge
              ? ` · collection ${displayMoney(Number(row.service.homeTestCharge), row.currency)} extra`
              : ""}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-right text-sm font-semibold">
        <Price row={row} />
      </p>
    </li>
  );
}

export function ProviderCard({ group }: { group: ProviderGroup }) {
  const [open, setOpen] = useState(false);
  const info = group.provider.providerInformation;
  const rating = info.rating;
  const shown = open ? group.services : group.services;
  const extra = group.total - 3;

  return (
    <article className="rounded-xl border border-[var(--line)] bg-white p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{group.provider.name}</h2>
          <p className="text-sm text-[var(--muted)]">
            {info.city?.name ?? "City unknown"}
            {info.country ? `, ${info.country.name}` : ""} · {info.currency}
          </p>
        </div>
        <p className="text-sm">
          {rating == null ? (
            <span className="text-[var(--muted)]">No reviews yet</span>
          ) : (
            <span>
              {rating.toFixed(1)} · {info.reviewCount} reviews
            </span>
          )}
        </p>
      </header>
      <ul>
        {(open ? shown : shown.slice(0, 3)).map((row) => (
          <ServiceRow key={row.service.id} row={row} />
        ))}
      </ul>
      {extra > 0 && !open ? (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-[var(--accent)] underline"
          onClick={() => setOpen(true)}
        >
          View all {group.total} services
        </button>
      ) : null}
      {open && extra > 0 ? (
        <button
          type="button"
          className="mt-2 text-sm text-[var(--muted)] underline"
          onClick={() => setOpen(false)}
        >
          Show fewer
        </button>
      ) : null}
    </article>
  );
}
