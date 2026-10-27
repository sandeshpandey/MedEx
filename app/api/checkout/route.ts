import { groupIsCheckoutable, type Cart } from "@/lib/cart";
import { getCart, peekOrderByKey, putOrder } from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    groupType: string;
    items: { id: string }[];
    paymentMethod: "card" | "pay_at_clinic";
    idempotencyKey: string;
  };
  if (!body.idempotencyKey) {
    return json({ message: "idempotencyKey required" }, 409);
  }
  const existing = peekOrderByKey(body.idempotencyKey);
  if (existing) return json({ orderId: existing.orderId, status: existing.status }, 201);
  const blocked = await mockGate(req, "checkout");
  if (blocked) return blocked;
  const cart: Cart = getCart();
  const group = cart.groups.find((g) => g.type === body.groupType);
  if (!group || !groupIsCheckoutable(group)) {
    return json({ message: "This group cannot be checked out yet." }, 409);
  }
  const created = putOrder(body.idempotencyKey, body.groupType, "paid");
  return json({ orderId: created.orderId, status: created.status }, 201);
}
