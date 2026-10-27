import { findLine, getCart, setLines } from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const blocked = await mockGate(req, "cart");
  if (blocked) return blocked;
  const { lineId } = await params;
  const line = findLine(lineId);
  if (!line) return json({ message: "Unknown line" }, 404);
  const body = (await req.json()) as {
    quantity?: number;
    wellnessPricingId?: string;
  };
  if (typeof body.quantity === "number") {
    if (body.quantity < 1 || body.quantity > 20) {
      return json({ message: "Quantity must be between 1 and 20." }, 409);
    }
    line.quantity = body.quantity;
  }
  if (body.wellnessPricingId) {
    const ok = line.product.wellnessPricing?.some((o) => o.id === body.wellnessPricingId);
    if (!ok) return json({ message: "Unknown duration." }, 409);
    line.wellnessPricingId = body.wellnessPricingId;
  }
  return json({ cart: getCart() });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const blocked = await mockGate(req, "cart");
  if (blocked) return blocked;
  const { lineId } = await params;
  const cart = getCart();
  const next = cart.groups.flatMap((g) => g.items).filter((l) => l.id !== lineId);
  setLines(next);
  return new Response(null, { status: 204 });
}

