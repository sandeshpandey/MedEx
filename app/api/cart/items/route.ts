import { catalog, getCart, setLines } from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function POST(req: Request) {
  const blocked = await mockGate(req, "cart");
  if (blocked) return blocked;
  const body = (await req.json()) as {
    productId: string;
    wellnessPricingId?: string;
  };
  const product = catalog().find((p) => p.id === body.productId);
  if (!product) return json({ message: "Unknown product" }, 404);
  const lines = getCart().groups.flatMap((g) => g.items);
  const existing = lines.find(
    (l) =>
      l.productId === body.productId &&
      l.wellnessPricingId === body.wellnessPricingId,
  );
  if (existing) existing.quantity += 1;
  else {
    lines.push({
      id: crypto.randomUUID(),
      productId: product.id,
      quantity: 1,
      wellnessPricingId: body.wellnessPricingId,
      product,
    });
  }
  setLines(lines);
  return json({ cart: getCart() }, 201);
}
