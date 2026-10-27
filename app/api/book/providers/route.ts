import { providers } from "@/lib/data/booking-store";
import { json, mockGate } from "@/lib/mock";
import { resolveTimeZone } from "@/lib/timezone";

export async function GET(req: Request) {
  const blocked = await mockGate(req, "book");
  if (blocked) return blocked;
  return json({
    providers: providers().map((p) => ({
      id: p.id,
      name: p.name,
      country: p.country,
      timezone: resolveTimeZone(p.timezone, p.country),
      specialists: p.specialists.map((s) => ({
        id: s.id,
        name: s.name,
        speciality: s.speciality,
      })),
    })),
  });
}
