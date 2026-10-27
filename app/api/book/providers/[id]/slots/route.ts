import { calendarFor, slotsFor } from "@/lib/data/booking-store";
import { json, mockGate } from "@/lib/mock";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await mockGate(req, "slots");
  if (blocked) return blocked;
  const { id } = await params;
  const url = new URL(req.url);
  const specialistId = url.searchParams.get("specialistId") ?? "";
  const date = url.searchParams.get("date");
  const people = Number(url.searchParams.get("people") ?? "1");
  if (!specialistId) return json({ message: "specialistId required" }, 400);
  if (!date) {
    const cal = calendarFor(Number(id), specialistId, people);
    if (!cal) return json({ message: "Unknown provider or specialist" }, 404);
    return json(cal);
  }
  const day = slotsFor(Number(id), date, specialistId, people);
  if (!day) return json({ message: "Unknown provider or specialist" }, 404);
  return json(day);
}
