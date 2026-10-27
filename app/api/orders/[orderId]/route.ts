import { getOrder } from "@/lib/data/cart-store";
import { json, mockGate } from "@/lib/mock";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const blocked = await mockGate(req, "checkout");
  if (blocked) return blocked;
  const { orderId } = await params;
  const order = getOrder(orderId);
  if (!order) return json({ message: "Unknown order" }, 404);
  return json(order);
}
