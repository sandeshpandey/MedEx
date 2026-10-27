import {
  addDays,
  diffDays,
  resolveTimeZone,
  wallToUtc,
  weekdayLong,
  ymdInZone,
} from "./timezone";

export type DayHours = { startTime: string; endTime: string };

export type Specialist = {
  id: string;
  name: string;
  speciality: string;
  consultation: {
    startTime: string;
    endTime: string;
    durationInMinutes: number;
    bufferInMinutes: number;
  };
};

export type BookingProvider = {
  id: number;
  name: string;
  country: string;
  timezone: string;
  daySchedules: Record<string, DayHours>;
  specialists: Specialist[];
};

export type Closure = { providerId: number; dayOffset: number; reason: string };
export type BookedSlot = {
  providerId: number;
  specialistId: string;
  dayOffset: number;
  startTime: string;
};

export type SlotStatus = "free" | "booked" | "past";

export type Slot = {
  startTime: string;
  endTime: string;
  status: SlotStatus;
  startUtc: string;
  startable: boolean;
};

export type DayReason = "ok" | "past" | "closed" | "holiday" | "full";

export const WINDOW_DAYS = 90;

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function originYmd(provider: BookingProvider, now = new Date()): string {
  const tz = resolveTimeZone(provider.timezone, provider.country).iana;
  return ymdInZone(now, tz);
}

export function generateDaySlots(opts: {
  provider: BookingProvider;
  specialist: Specialist;
  ymd: string;
  originYmd: string;
  closures: Closure[];
  booked: BookedSlot[];
  now?: Date;
  people?: number;
}): {
  reason: DayReason;
  reasonText: string;
  slots: Slot[];
  clipped: boolean;
  open: DayHours | null;
} {
  const {
    provider,
    specialist,
    ymd,
    originYmd: origin,
    closures,
    booked,
    now = new Date(),
    people = 1,
  } = opts;
  const tz = resolveTimeZone(provider.timezone, provider.country).iana;
  const offset = diffDays(origin, ymd);
  const today = ymdInZone(now, tz);

  if (ymd < today) {
    return {
      reason: "past",
      reasonText: "This day has already passed at the clinic.",
      slots: [],
      clipped: false,
      open: null,
    };
  }
  if (offset < 0 || offset >= WINDOW_DAYS) {
    return {
      reason: "past",
      reasonText: "Bookings open for the next 90 days only.",
      slots: [],
      clipped: false,
      open: null,
    };
  }

  const holiday = closures.find(
    (c) => c.providerId === provider.id && c.dayOffset === offset,
  );
  if (holiday) {
    return {
      reason: "holiday",
      reasonText: holiday.reason,
      slots: [],
      clipped: false,
      open: null,
    };
  }

  const weekday = weekdayLong(ymd, tz);
  const open = provider.daySchedules[weekday] ?? null;
  if (!open) {
    return {
      reason: "closed",
      reasonText: "The clinic is closed on this weekday.",
      slots: [],
      clipped: false,
      open: null,
    };
  }

  const consult = specialist.consultation;
  const step = consult.durationInMinutes + consult.bufferInMinutes;
  const openStart = minutes(open.startTime);
  const openEnd = minutes(open.endTime);
  const consultStart = minutes(consult.startTime);
  const consultEnd = minutes(consult.endTime);
  const bookedTimes = new Set(
    booked
      .filter(
        (b) =>
          b.providerId === provider.id &&
          b.specialistId === specialist.id &&
          b.dayOffset === offset,
      )
      .map((b) => b.startTime),
  );

  let clipped = false;
  const raw: Slot[] = [];
  for (let t = consultStart; t + consult.durationInMinutes <= consultEnd; t += step) {
    const end = t + consult.durationInMinutes;
    if (t < openStart || end > openEnd) {
      clipped = true;
      continue;
    }
    const startTime = fromMinutes(t);
    const startUtc = wallToUtc(ymd, startTime, tz);
    let status: SlotStatus = bookedTimes.has(startTime) ? "booked" : "free";
    if (ymd === today && startUtc.getTime() <= now.getTime()) status = "past";
    raw.push({
      startTime,
      endTime: fromMinutes(end),
      status,
      startUtc: startUtc.toISOString(),
      startable: status === "free",
    });
  }

  const n = Math.min(4, Math.max(1, people));
  const slots = raw.map((slot, i) => {
    const window = raw.slice(i, i + n);
    const startable =
      window.length === n && window.every((s) => s.status === "free");
    return { ...slot, startable };
  });

  const anyStart = slots.some((s) => s.startable);
  if (!anyStart) {
    return {
      reason: "full",
      reasonText: raw.length
        ? "No free slots left for this party size."
        : "The specialist’s hours do not overlap clinic opening hours this day.",
      slots,
      clipped,
      open,
    };
  }

  return { reason: "ok", reasonText: "", slots, clipped, open };
}

export function calendarDays(opts: {
  provider: BookingProvider;
  specialist: Specialist;
  originYmd: string;
  closures: Closure[];
  booked: BookedSlot[];
  now?: Date;
  people?: number;
}): { ymd: string; reason: DayReason; reasonText: string }[] {
  const out = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const ymd = addDays(opts.originYmd, i);
    const day = generateDaySlots({ ...opts, ymd });
    out.push({ ymd, reason: day.reason, reasonText: day.reasonText });
  }
  return out;
}
