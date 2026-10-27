import { nearestAlternatives, takeSlot } from "@/lib/data/booking-store";
import { json, mockGate } from "@/lib/mock";

export async function POST(req: Request) {
  const blocked = await mockGate(req, "book");
  if (blocked) return blocked;
  const body = (await req.json()) as {
    providerId: number;
    specialistId: string;
    date: string;
    startTime: string;
    numberOfPeople: number;
  };
  const result = takeSlot({
    providerId: body.providerId,
    specialistId: body.specialistId,
    ymd: body.date,
    startTime: body.startTime,
    numberOfPeople: body.numberOfPeople,
  });
  if (result.status === 409) {
    return json(
      {
        message: (result.body as { message: string }).message,
        alternatives: nearestAlternatives(
          body.providerId,
          body.specialistId,
          body.date,
          body.startTime,
          body.numberOfPeople,
        ),
      },
      409,
    );
  }
  return json(result.body, result.status);
}
