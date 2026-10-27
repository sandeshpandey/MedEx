import type { Currency, ServiceType } from "./types";

export type WellnessPrice = {
  id: string;
  durationInMinutes: number;
  amount_after_service_charge: number;
};

export type CartProduct = {
  id?: string;
  title?: string;
  type?: ServiceType | "unknown";
  currency?: Currency;
  providerId?: number;
  providerName?: string;
  price?: number | null;
  priceUnknown?: boolean;
  wellnessPricing?: WellnessPrice[];
};

export type CartLine = {
  id: string;
  productId: string;
  quantity: number;
  wellnessPricingId?: string;
  product: CartProduct;
};

export type CartGroup = {
  type: string;
  itemCount: number;
  unpricedItems: number;
  subtotals: Record<string, number>;
  items: CartLine[];
};

export type Cart = {
  groups: CartGroup[];
  totalItems: number;
};

export type GuestItem = {
  productId: string;
  quantity: number;
  wellnessPricingId?: string;
};

export type CatalogProduct = CartProduct & {
  id: string;
  type: ServiceType;
  title: string;
};

export type MergeChange =
  | { kind: "qty_added"; title: string; from: number; to: number }
  | { kind: "duration_set"; title: string; minutes: number }
  | { kind: "added"; title: string; quantity: number }
  | { kind: "skipped_unknown"; productId: string };

export function isUnavailable(product: CartProduct): boolean {
  return !product.id || !product.title;
}

export function lineUnitPrice(line: CartLine): number | null {
  if (isUnavailable(line.product)) return null;
  if (line.product.type === "wellness") {
    const opt = line.product.wellnessPricing?.find(
      (o) => o.id === line.wellnessPricingId,
    );
    return opt ? opt.amount_after_service_charge : null;
  }
  if (line.product.price == null || line.product.priceUnknown) return null;
  return line.product.price;
}

export function lineTotal(line: CartLine): { amount: number; currency: string } | null {
  const unit = lineUnitPrice(line);
  const currency = line.product.currency;
  if (unit == null || !currency) return null;
  return { amount: unit * line.quantity, currency };
}

export function rebuildCart(lines: CartLine[]): Cart {
  const byType = new Map<string, CartLine[]>();
  for (const line of lines) {
    const type = isUnavailable(line.product)
      ? "unknown"
      : (line.product.type ?? "unknown");
    const list = byType.get(type);
    if (list) list.push(line);
    else byType.set(type, [line]);
  }
  const groups: CartGroup[] = [...byType.entries()].map(([type, items]) => {
    const subtotals: Record<string, number> = {};
    let unpricedItems = 0;
    let itemCount = 0;
    for (const item of items) {
      itemCount += item.quantity;
      const tot = lineTotal(item);
      if (!tot) {
        unpricedItems += item.quantity;
        continue;
      }
      subtotals[tot.currency] = (subtotals[tot.currency] ?? 0) + tot.amount;
    }
    return { type, items, itemCount, unpricedItems, subtotals };
  });
  return {
    groups,
    totalItems: lines.reduce((n, l) => n + l.quantity, 0),
  };
}

function newId(): string {
  return crypto.randomUUID();
}

export function mergeGuestCart(
  serverLines: CartLine[],
  guest: GuestItem[],
  catalog: CatalogProduct[],
): { lines: CartLine[]; changes: MergeChange[] } {
  const catalogById = new Map(catalog.map((p) => [p.id, p]));
  const lines: CartLine[] = serverLines.map((l) => ({
    ...l,
    product: { ...l.product },
    wellnessPricingId: l.wellnessPricingId,
  }));
  const changes: MergeChange[] = [];

  function identity(productId: string, wellnessPricingId?: string) {
    return `${productId}::${wellnessPricingId ?? ""}`;
  }

  const index = new Map<string, CartLine>();
  for (const line of lines) {
    index.set(identity(line.productId, line.wellnessPricingId), line);
  }

  for (const item of guest) {
    const product = catalogById.get(item.productId);
    if (!product) {
      changes.push({ kind: "skipped_unknown", productId: item.productId });
      continue;
    }
    const key = identity(item.productId, item.wellnessPricingId);
    const existing =
      index.get(key) ??
      (item.wellnessPricingId
        ? index.get(identity(item.productId, undefined))
        : undefined);
    if (existing) {
      const from = existing.quantity;
      existing.quantity += item.quantity;
      changes.push({
        kind: "qty_added",
        title: existing.product.title ?? product.title,
        from,
        to: existing.quantity,
      });
      if (item.wellnessPricingId && !existing.wellnessPricingId) {
        existing.wellnessPricingId = item.wellnessPricingId;
        const minutes = product.wellnessPricing?.find(
          (o) => o.id === item.wellnessPricingId,
        )?.durationInMinutes;
        if (minutes != null) {
          changes.push({
            kind: "duration_set",
            title: product.title,
            minutes,
          });
        }
        index.delete(identity(item.productId, undefined));
        index.set(key, existing);
      }
      continue;
    }
    const line: CartLine = {
      id: newId(),
      productId: product.id,
      quantity: item.quantity,
      wellnessPricingId: item.wellnessPricingId,
      product,
    };
    lines.push(line);
    index.set(key, line);
    changes.push({ kind: "added", title: product.title, quantity: item.quantity });
  }

  return { lines, changes };
}

export function groupIsCheckoutable(group: CartGroup): boolean {
  if (group.type === "unknown") return false;
  return group.items.every((item) => lineUnitPrice(item) != null);
}
