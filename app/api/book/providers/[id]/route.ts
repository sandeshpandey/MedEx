import { existingBooking, provider } from "@/lib/data/booking-store";
import { json, mockGate } from "@/lib/mock";
import { resolveTimeZone } from "@/lib/timezone";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await mockGate(req, "book");
  if (blocked) return blocked;
  const { id } = await params;
  const p = provider(Number(id));
  if (!p) return json({ message: "Unknown provider" }, 404);
  return json({
    provider: {
      ...p,
      timezone: resolveTimeZone(p.timezone, p.country),
    },
    existingBooking: existingBooking(),
  });
}
