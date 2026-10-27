import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rebuildCart,
  type Cart,
  type CartLine,
  type CatalogProduct,
  type GuestItem,
} from "../cart";

type FileShape = {
  catalog: CatalogProduct[];
  serverCart: Cart;
  guestCart: GuestItem[];
};

const file = JSON.parse(
  readFileSync(join(process.cwd(), "data/task2-cart.json"), "utf8"),
) as FileShape;

function flatten(cart: Cart): CartLine[] {
  return cart.groups.flatMap((g) => g.items);
}

let lines: CartLine[] = flatten(structuredClone(file.serverCart));

const orders = new Map<
  string,
  { orderId: string; status: "pending" | "paid" | "failed"; groupType: string }
>();
const idempotency = new Map<string, string>();

export function catalog(): CatalogProduct[] {
  return file.catalog;
}

export function guestCart(): GuestItem[] {
  return file.guestCart;
}

export function getCart(): Cart {
  return rebuildCart(lines);
}

export function setLines(next: CartLine[]): Cart {
  lines = next;
  return getCart();
}

export function findLine(id: string): CartLine | undefined {
  return lines.find((l) => l.id === id);
}

export function resetCart(): void {
  lines = flatten(structuredClone(file.serverCart));
  orders.clear();
  idempotency.clear();
}

export function peekOrderByKey(idempotencyKey: string) {
  const id = idempotency.get(idempotencyKey);
  return id ? (orders.get(id) ?? null) : null;
}

export function putOrder(
  idempotencyKey: string,
  groupType: string,
  status: "pending" | "paid" | "failed",
): { orderId: string; status: "pending" | "paid" | "failed" } {
  const existing = idempotency.get(idempotencyKey);
  if (existing) {
    const order = orders.get(existing)!;
    return { orderId: order.orderId, status: order.status };
  }
  const orderId = `ORD-${idempotencyKey.slice(0, 8)}`;
  idempotency.set(idempotencyKey, orderId);
  orders.set(orderId, { orderId, status, groupType });
  return { orderId, status };
}

export function getOrder(orderId: string) {
  return orders.get(orderId) ?? null;
}

export function setOrderStatus(
  orderId: string,
  status: "pending" | "paid" | "failed",
) {
  const o = orders.get(orderId);
  if (o) o.status = status;
}
