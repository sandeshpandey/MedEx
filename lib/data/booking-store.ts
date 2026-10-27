import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calendarDays,
  generateDaySlots,
  originYmd,
  type BookedSlot,
  type BookingProvider,
  type Closure,
} from "../slots";
import { addDays, diffDays, resolveTimeZone } from "../timezone";

type FileShape = {
  providers: BookingProvider[];
  closures: Closure[];
  bookedSlots: BookedSlot[];
  existingBooking: {
    bookingId: string;
    providerId: number;
    specialistId: string;
    dayOffset: number;
    startTime: string;
    numberOfPeople: number;
  };
};

const file = JSON.parse(
  readFileSync(join(process.cwd(), "data/task3-booking.json"), "utf8"),
) as FileShape;

const booked: BookedSlot[] = file.bookedSlots.map((b) => ({ ...b }));
const bookings = new Map<
  string,
  {
    bookingId: string;
    providerId: number;
    specialistId: string;
    ymd: string;
    startTime: string;
    numberOfPeople: number;
  }
>();

function origins(now = new Date()): Map<number, string> {
  const map = new Map<number, string>();
  for (const p of file.providers) map.set(p.id, originYmd(p, now));
  return map;
}

const originByProvider = origins();

{
  const seed = file.existingBooking;
  booked.push({
    providerId: seed.providerId,
    specialistId: seed.specialistId,
    dayOffset: seed.dayOffset,
    startTime: seed.startTime,
  });
}

export function providers(): BookingProvider[] {
  return file.providers;
}

export function provider(id: number): BookingProvider | undefined {
  return file.providers.find((p) => p.id === id);
}

export function existingBooking() {
  const p = provider(file.existingBooking.providerId)!;
  const origin = originByProvider.get(p.id)!;
  return {
    ...file.existingBooking,
    ymd: addDays(origin, file.existingBooking.dayOffset),
    timezone: resolveTimeZone(p.timezone, p.country),
    providerName: p.name,
    specialistName:
      p.specialists.find((s) => s.id === file.existingBooking.specialistId)?.name ??
      "",
  };
}

export function slotsFor(
  providerId: number,
  ymd: string,
  specialistId: string,
  people: number,
  now = new Date(),
) {
  const p = provider(providerId);
  if (!p) return null;
  const specialist = p.specialists.find((s) => s.id === specialistId);
  if (!specialist) return null;
  const origin = originByProvider.get(p.id) ?? originYmd(p, now);
  return {
    timezone: resolveTimeZone(p.timezone, p.country),
    ...generateDaySlots({
      provider: p,
      specialist,
      ymd,
      originYmd: origin,
      closures: file.closures,
      booked,
      now,
      people,
    }),
  };
}

export function calendarFor(
  providerId: number,
  specialistId: string,
  people: number,
  now = new Date(),
) {
  const p = provider(providerId);
  if (!p) return null;
  const specialist = p.specialists.find((s) => s.id === specialistId);
  if (!specialist) return null;
  const origin = originByProvider.get(p.id) ?? originYmd(p, now);
  return {
    origin,
    timezone: resolveTimeZone(p.timezone, p.country),
    days: calendarDays({
      provider: p,
      specialist,
      originYmd: origin,
      closures: file.closures,
      booked,
      now,
      people,
    }),
  };
}

function occupy(opts: {
  providerId: number;
  specialistId: string;
  ymd: string;
  times: string[];
}) {
  const origin = originByProvider.get(opts.providerId)!;
  const dayOffset = diffDays(origin, opts.ymd);
  for (const startTime of opts.times) {
    booked.push({
      providerId: opts.providerId,
      specialistId: opts.specialistId,
      dayOffset,
      startTime,
    });
  }
}

function release(opts: {
  providerId: number;
  specialistId: string;
  ymd: string;
  startTime: string;
  people: number;
}) {
  const p = provider(opts.providerId)!;
  const origin = originByProvider.get(p.id)!;
  const dayOffset = diffDays(origin, opts.ymd);
  const specialist = p.specialists.find((s) => s.id === opts.specialistId)!;
  const day = generateDaySlots({
    provider: p,
    specialist,
    ymd: opts.ymd,
    originYmd: origin,
    closures: file.closures,
    booked,
    people: 1,
  });
  const idx = day.slots.findIndex((s) => s.startTime === opts.startTime);
  const times = new Set(
    day.slots.slice(idx, idx + opts.people).map((s) => s.startTime),
  );
  for (let i = booked.length - 1; i >= 0; i--) {
    const b = booked[i];
    if (
      b.providerId === opts.providerId &&
      b.specialistId === opts.specialistId &&
      b.dayOffset === dayOffset &&
      times.has(b.startTime)
    ) {
      booked.splice(i, 1);
    }
  }
}

export function takeSlot(opts: {
  providerId: number;
  specialistId: string;
  ymd: string;
  startTime: string;
  numberOfPeople: number;
  bookingId?: string;
}): { status: 201 | 200 | 409 | 404; body: unknown } {
  const p = provider(opts.providerId);
  if (!p) return { status: 404, body: { message: "Unknown provider" } };
  const origin = originByProvider.get(p.id)!;
  const specialist = p.specialists.find((s) => s.id === opts.specialistId);
  if (!specialist) return { status: 404, body: { message: "Unknown specialist" } };
  const day = generateDaySlots({
    provider: p,
    specialist,
    ymd: opts.ymd,
    originYmd: origin,
    closures: file.closures,
    booked,
    people: opts.numberOfPeople,
  });
  const start = day.slots.find((s) => s.startTime === opts.startTime);
  if (!start?.startable) {
    return { status: 409, body: { message: "That time is no longer available." } };
  }
  const idx = day.slots.findIndex((s) => s.startTime === opts.startTime);
  occupy({
    providerId: opts.providerId,
    specialistId: opts.specialistId,
    ymd: opts.ymd,
    times: day.slots.slice(idx, idx + opts.numberOfPeople).map((s) => s.startTime),
  });
  const bookingId =
    opts.bookingId ?? `BK-${opts.ymd}-${opts.startTime.replace(":", "")}`;
  bookings.set(bookingId, {
    bookingId,
    providerId: opts.providerId,
    specialistId: opts.specialistId,
    ymd: opts.ymd,
    startTime: opts.startTime,
    numberOfPeople: opts.numberOfPeople,
  });
  return { status: opts.bookingId ? 200 : 201, body: { bookingId } };
}

export function moveBooking(
  bookingId: string,
  ymd: string,
  startTime: string,
): { status: 200 | 409 | 404; body: unknown } {
  const seed = existingBooking();
  const current =
    bookings.get(bookingId) ??
    (seed.bookingId === bookingId
      ? {
          bookingId: seed.bookingId,
          providerId: seed.providerId,
          specialistId: seed.specialistId,
          ymd: seed.ymd,
          startTime: seed.startTime,
          numberOfPeople: seed.numberOfPeople,
        }
      : null);
  if (!current) return { status: 404, body: { message: "Unknown booking" } };
  release({
    providerId: current.providerId,
    specialistId: current.specialistId,
    ymd: current.ymd,
    startTime: current.startTime,
    people: current.numberOfPeople,
  });
  const result = takeSlot({
    providerId: current.providerId,
    specialistId: current.specialistId,
    ymd,
    startTime,
    numberOfPeople: current.numberOfPeople,
    bookingId,
  });
  if (result.status === 201 || result.status === 200) {
    return { status: 200, body: result.body };
  }
  takeSlot({
    providerId: current.providerId,
    specialistId: current.specialistId,
    ymd: current.ymd,
    startTime: current.startTime,
    numberOfPeople: current.numberOfPeople,
    bookingId,
  });
  return { status: result.status === 409 ? 409 : 404, body: result.body };
}

export function nearestAlternatives(
  providerId: number,
  specialistId: string,
  ymd: string,
  startTime: string,
  people: number,
): string[] {
  const day = slotsFor(providerId, ymd, specialistId, people);
  if (!day) return [];
  const target = day.slots.find((s) => s.startTime === startTime);
  const t = target ? Date.parse(target.startUtc) : 0;
  return day.slots
    .filter((s) => s.startable)
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.startUtc) - t) - Math.abs(Date.parse(b.startUtc) - t),
    )
    .slice(0, 3)
    .map((s) => s.startTime);
}
