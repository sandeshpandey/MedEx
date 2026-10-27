"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import {
  groupIsCheckoutable,
  isUnavailable,
  lineTotal,
  lineUnitPrice,
  type Cart,
  type CartGroup,
  type CartLine,
  type CatalogProduct,
  type GuestItem,
  type MergeChange,
} from "@/lib/cart";
import {
  applyResult,
  clearSession,
  newIdempotencyKey,
  readSession,
  retryable,
  writeSession,
  type CheckoutSession,
} from "@/lib/checkout";
import { displayMoney } from "@/lib/pricing";
import { createCoalescedUpdater } from "@/lib/qty";

type CatalogRes = { catalog: CatalogProduct[]; guestCart: GuestItem[] };

function moneyMap(map: Record<string, number>): string {
  const parts = Object.entries(map).map(([c, n]) => displayMoney(n, c));
  return parts.length ? parts.join(" + ") : "—";
}

function Line({
  line,
  onCart,
  onRemoved,
}: {
  line: CartLine;
  onCart: (cart: Cart) => void;
  onRemoved: (id: string) => void;
}) {
  const [qty, setQty] = useState(line.quantity);
  const [err, setErr] = useState<string | null>(null);
  const busy = useRef(false);
  const ctrl = useRef<ReturnType<typeof createCoalescedUpdater<number>> | undefined>(
    undefined,
  );
  if (!ctrl.current) {
    ctrl.current = createCoalescedUpdater({
      confirmed: line.quantity,
      send: async (n) => {
        const res = await api<{ cart: Cart }>(`/api/cart/items/${line.id}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: n }),
        });
        onCart(res.cart);
        return n;
      },
      onChange: (optimistic, confirmed, error) => {
        busy.current = optimistic !== confirmed;
        setQty(optimistic);
        setErr(error ?? null);
        if (error) {
          busy.current = false;
          setQty(confirmed);
        }
      },
    });
  }
  useEffect(() => {
    if (!busy.current) setQty(line.quantity);
  }, [line.quantity]);

  const unavailable = isUnavailable(line.product);
  const unit = lineUnitPrice(line);
  const tot = lineTotal(line);

  return (
    <article
      id={`line-${line.id}`}
      tabIndex={-1}
      className="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--line)] py-3"
    >
      <div>
        <h3 className="font-medium">
          {unavailable ? "This service is no longer available" : line.product.title}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {unavailable
            ? "The provider removed it. It cannot be checked out."
            : `${line.product.providerName} · ${line.product.currency}`}
        </p>
        {line.product.type === "wellness" && !unavailable ? (
          <label className="mt-2 block text-sm">
            Duration
            <select
              className="ml-2 rounded border border-[var(--line)] px-2 py-1"
              value={line.wellnessPricingId ?? ""}
              onChange={async (e) => {
                const res = await api<{ cart: Cart }>(`/api/cart/items/${line.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ wellnessPricingId: e.target.value }),
                });
                onCart(res.cart);
              }}
            >
              <option value="">Choose a duration</option>
              {line.product.wellnessPricing?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.durationInMinutes} min ·{" "}
                  {displayMoney(o.amount_after_service_charge, line.product.currency!)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {unit == null && !unavailable ? (
          <p className="text-sm text-[var(--warn)]">Price unknown until you choose a duration.</p>
        ) : null}
        {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {unavailable ? null : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded border border-[var(--line)] px-2"
              aria-label={`Decrease quantity of ${line.product.title}`}
              onClick={() => ctrl.current?.set(Math.max(1, qty - 1))}
            >
              −
            </button>
            <span className="w-6 text-center tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              className="rounded border border-[var(--line)] px-2"
              aria-label={`Increase quantity of ${line.product.title}`}
              onClick={() => ctrl.current?.set(qty + 1)}
            >
              +
            </button>
          </div>
        )}
        <p className="w-28 text-right text-sm font-semibold">
          {tot ? displayMoney(tot.amount, tot.currency) : "—"}
        </p>
        <button
          type="button"
          className="text-sm underline"
          onClick={async () => {
            await api(`/api/cart/items/${line.id}`, { method: "DELETE" });
            onRemoved(line.id);
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}

export function CartApp() {
  const live = useId();
  const [cart, setCart] = useState<Cart | null>(null);
  const [catalog, setCatalog] = useState<CatalogRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<MergeChange[] | null>(null);
  const [methods, setMethods] = useState<Record<string, "card" | "pay_at_clinic">>(
    {},
  );
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const [c, cat] = await Promise.all([
        api<{ cart: Cart }>("/api/cart"),
        api<CatalogRes>("/api/cart/catalog"),
      ]);
      setCart(c.cart);
      setCatalog(cat);
    } catch {
      setError("Could not load the cart.");
    }
  }

  useEffect(() => {
    void load();
    const stored = readSession();
    if (!stored) return;
    setSession(stored);
    void Promise.all(
      stored.groups
        .filter((g) => g.orderId)
        .map(async (g) => {
          try {
            const o = await api<{ orderId: string; status: "pending" | "paid" | "failed" }>(
              `/api/orders/${g.orderId}`,
            );
            g.status = o.status === "paid" || o.status === "pending" ? "paid" : "failed";
          } catch (e) {
            if (e instanceof ApiError && e.status === 0) g.status = "unknown";
          }
        }),
    ).then(() => {
      writeSession(stored);
      setSession({ ...stored, groups: [...stored.groups] });
    });
  }, []);

  async function runCheckout(groups: CartGroup[]) {
    const ready = groups.filter(groupIsCheckoutable);
    if (!ready.length) return;
    setBusy(true);
    const next: CheckoutSession = {
      groups: session ? session.groups.map((g) => ({ ...g })) : [],
    };
    for (const g of ready) {
      if (!next.groups.some((x) => x.type === g.type)) {
        next.groups.push({
          type: g.type,
          paymentMethod: methods[g.type] ?? "card",
          idempotencyKey: newIdempotencyKey(g.type),
          status: "ready",
        });
      }
    }
    writeSession(next);
    setSession(next);
    for (const g of next.groups) {
      if (!ready.some((r) => r.type === g.type)) continue;
      if (g.status === "paid") continue;
      g.status = "submitting";
      writeSession(next);
      setSession({ ...next, groups: [...next.groups] });
      try {
        const res = await api<{ orderId: string; status: "pending" | "paid" | "failed" }>(
          "/api/checkout",
          {
            method: "POST",
            body: JSON.stringify({
              groupType: g.type,
              items: cart?.groups.find((x) => x.type === g.type)?.items.map((i) => ({ id: i.id })),
              paymentMethod: g.paymentMethod,
              idempotencyKey: g.idempotencyKey,
            }),
          },
        );
        Object.assign(g, applyResult(g, { ok: true, ...res }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) {
          Object.assign(g, applyResult(g, { ok: false, status: 0, unknown: true }));
        } else if (e instanceof ApiError) {
          const message =
            typeof e.body === "object" && e.body && "message" in e.body
              ? String((e.body as { message: string }).message)
              : `Checkout failed (${e.status})`;
          Object.assign(g, applyResult(g, { ok: false, status: e.status, message }));
        } else {
          Object.assign(g, applyResult(g, { ok: false, status: 0, unknown: true }));
        }
      }
      writeSession(next);
      setSession({ ...next, groups: [...next.groups] });
    }
    setBusy(false);
  }

  function focusNeighbor(removedId: string) {
    const ids = cart?.groups.flatMap((g) => g.items.map((i) => i.id)) ?? [];
    const i = ids.indexOf(removedId);
    const next = ids[i + 1] ?? ids[i - 1];
    void api<{ cart: Cart }>("/api/cart")
      .then((r) => {
        setCart(r.cart);
        requestAnimationFrame(() => {
          const el = next
            ? document.getElementById(`line-${next}`)
            : document.getElementById("cart-heading");
          el?.focus();
        });
      })
      .catch(() => void load());
  }

  if (error) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          Try again
        </button>
      </main>
    );
  }

  if (!cart) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--line)]" />
      </main>
    );
  }

  if (cart.totalItems === 0) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <h1 id="cart-heading" tabIndex={-1} className="text-2xl font-semibold">
          Your cart is empty
        </h1>
        <p className="mt-2 text-[var(--muted)]">Add a service from the catalog below.</p>
        <Catalog catalog={catalog} onCart={setCart} />
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <h1 id="cart-heading" tabIndex={-1} className="text-2xl font-semibold">
        Cart
      </h1>
      <p id={live} className="mt-1 text-sm text-[var(--muted)]" aria-live="polite">
        {cart.totalItems} items. Each group is paid separately. Amounts in different
        currencies are never added together.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
          onClick={async () => {
            const res = await api<{ cart: Cart; changes: MergeChange[] }>("/api/cart/merge", {
              method: "POST",
              body: JSON.stringify({ items: catalog?.guestCart ?? [] }),
            });
            setCart(res.cart);
            setChanges(res.changes);
          }}
        >
          Log in and merge guest cart
        </button>
      </div>

      {changes ? (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
          <p className="font-semibold">What changed after login</p>
          <ul className="mt-1 list-disc pl-5">
            {changes.map((c, i) => (
              <li key={i}>
                {c.kind === "qty_added"
                  ? `${c.title}: quantity ${c.from} → ${c.to}`
                  : c.kind === "duration_set"
                    ? `${c.title}: duration set to ${c.minutes} minutes`
                    : c.kind === "added"
                      ? `Added ${c.title} (×${c.quantity})`
                      : `Skipped a service that is no longer listed (${c.productId.slice(0, 8)}…)`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 space-y-6">
        {cart.groups.map((group) => (
          <section key={group.type} className="rounded-xl border border-[var(--line)] bg-white p-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold capitalize">{group.type.replace("_", " ")}</h2>
              <p className="text-sm">
                {group.itemCount} items
                {group.unpricedItems ? ` · ${group.unpricedItems} unpriced` : ""}
              </p>
            </header>
            {group.items.map((line) => (
              <Line
                key={line.id}
                line={line}
                onCart={setCart}
                onRemoved={focusNeighbor}
              />
            ))}
            <p className="mt-3 text-sm font-semibold">
              Subtotal {moneyMap(group.subtotals)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <fieldset className="flex gap-3 text-sm">
                <legend className="sr-only">Payment for {group.type}</legend>
                {(["card", "pay_at_clinic"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`pay-${group.type}`}
                      checked={(methods[group.type] ?? "card") === m}
                      onChange={() => setMethods({ ...methods, [group.type]: m })}
                    />
                    {m === "card" ? "Card" : "Pay at clinic"}
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={!groupIsCheckoutable(group) || busy}
                onClick={() => void runCheckout([group])}
              >
                Check out this group
              </button>
            </div>
            {!groupIsCheckoutable(group) ? (
              <p className="mt-2 text-sm text-[var(--warn)]">
                Choose a duration and remove unavailable items before paying.
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          To pay:{" "}
          {cart.groups
            .filter(groupIsCheckoutable)
            .map((g) => `${g.type.replace("_", " ")} ${moneyMap(g.subtotals)}`)
            .join(" · ") || "nothing ready"}
        </p>
        <button
          type="button"
          className="rounded bg-[var(--ink)] px-4 py-2 text-white disabled:opacity-50"
          disabled={busy || !cart.groups.some(groupIsCheckoutable)}
          onClick={() => void runCheckout(cart.groups)}
        >
          Check out all ready groups
        </button>
      </div>

      {session ? (
        <section className="mt-8 rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Checkout status</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {session.groups.map((g) => (
              <li key={g.type} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {g.type.replace("_", " ")} · {g.status}
                  {g.orderId ? ` · ${g.orderId}` : ""}
                  {g.message ? ` — ${g.message}` : ""}
                </span>
                {retryable(g) ? (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      g.status = "ready";
                      void runCheckout(
                        cart.groups.filter((x) => x.type === g.type),
                      );
                    }}
                  >
                    Retry this group
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {session.groups.every((g) => g.status === "paid") ? (
            <button
              type="button"
              className="mt-3 text-sm underline"
              onClick={() => {
                clearSession();
                setSession(null);
              }}
            >
              Clear status
            </button>
          ) : null}
        </section>
      ) : null}

      <Catalog catalog={catalog} onCart={setCart} />
    </main>
  );
}

function Catalog({
  catalog,
  onCart,
}: {
  catalog: CatalogRes | null;
  onCart: (cart: Cart) => void;
}) {
  if (!catalog) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Add from catalog</h2>
      <ul className="mt-3 grid gap-2">
        {catalog.catalog.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <span>
              {p.title} · {p.providerName} · {p.type}
            </span>
            <button
              type="button"
              className="underline"
              onClick={async () => {
                const res = await api<{ cart: Cart }>("/api/cart/items", {
                  method: "POST",
                  body: JSON.stringify({ productId: p.id }),
                });
                onCart(res.cart);
              }}
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

