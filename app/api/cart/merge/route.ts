import { mergeGuestCart } from "@/lib/cart";
import {
  catalog,
  getCart,
  guestCart,
  setLines,
} from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function POST(req: Request) {
  const blocked = await mockGate(req, "cart");
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as {
    items?: ReturnType<typeof guestCart>;
  };
  const items = body.items ?? guestCart();
  const current = getCart().groups.flatMap((g) => g.items);
  const { lines, changes } = mergeGuestCart(current, items, catalog());
  setLines(lines);
  return json({ cart: getCart(), changes });
}
