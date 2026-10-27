import {
  existingBooking,
  moveBooking,
  nearestAlternatives,
} from "@/lib/data/booking-store";
import { json, mockGate } from "@/lib/mock";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await mockGate(req, "book");
  if (blocked) return blocked;
  const { id } = await params;
  const body = (await req.json()) as { date: string; startTime: string };
  const result = moveBooking(id, body.date, body.startTime);
  if (result.status === 409) {
    const seed = existingBooking();
    return json(
      {
        ...(result.body as object),
        alternatives: nearestAlternatives(
          seed.providerId,
          seed.specialistId,
          body.date,
          body.startTime,
          seed.numberOfPeople,
        ),
      },
      409,
    );
  }
  return json(result.body, result.status);
}
