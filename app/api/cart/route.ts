import { getCart } from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function GET(req: Request) {
  const blocked = await mockGate(req, "cart");
  if (blocked) return blocked;
  return json({ cart: getCart() });
}
