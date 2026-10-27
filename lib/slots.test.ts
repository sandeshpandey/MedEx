import { expect, test } from "vitest";
import { generateDaySlots, type BookingProvider, type Specialist } from "./slots";

const riverside: BookingProvider = {
  id: 48,
  name: "Riverside",
  country: "TH",
  timezone: "Asia/Bangkok",
  daySchedules: {
    monday: { startTime: "08:00", endTime: "20:00" },
    friday: { startTime: "08:00", endTime: "17:00" },
    saturday: { startTime: "09:00", endTime: "13:00" },
  },
  specialists: [],
};

const wongsakul: Specialist = {
  id: "w",
  name: "Dr. A. Wongsakul",
  speciality: "Cardiology",
  consultation: {
    startTime: "10:00",
    endTime: "16:00",
    durationInMinutes: 30,
    bufferInMinutes: 10,
  },
};

const chaiyaporn: Specialist = {
  id: "c",
  name: "Dr. P. Chaiyaporn",
  speciality: "Dermatology",
  consultation: {
    startTime: "07:00",
    endTime: "12:00",
    durationInMinutes: 45,
    bufferInMinutes: 15,
  },
};

const rana: Specialist = {
  id: "r",
  name: "Dr. N. Rana",
  speciality: "Internal Medicine",
  consultation: {
    startTime: "18:00",
    endTime: "21:00",
    durationInMinutes: 20,
    bufferInMinutes: 0,
  },
};

const origin = "2026-10-26";
const monday = "2026-10-26";
const friday = "2026-10-30";

test("30+10 buffer walks 10:00, 10:40, 11:20", () => {
  const { slots } = generateDaySlots({
    provider: riverside,
    specialist: wongsakul,
    ymd: monday,
    originYmd: origin,
    closures: [],
    booked: [],
    now: new Date("2026-10-26T00:00:00+07:00"),
  });
  expect(slots.slice(0, 3).map((s) => s.startTime)).toEqual([
    "10:00",
    "10:40",
    "11:20",
  ]);
  expect(slots[slots.length - 1].endTime <= "16:00").toBe(true);
});

test("Chaiyaporn 07:00 is dropped because the clinic opens at 08:00", () => {
  const { slots, clipped } = generateDaySlots({
    provider: riverside,
    specialist: chaiyaporn,
    ymd: monday,
    originYmd: origin,
    closures: [],
    booked: [],
    now: new Date("2026-10-26T00:00:00+07:00"),
  });
  expect(clipped).toBe(true);
  expect(slots[0]?.startTime).toBe("08:00");
  expect(slots.some((s) => s.startTime === "07:00")).toBe(false);
});

test("Rana after 20:00 is dropped on a 20:00 close; Friday has no overlap", () => {
  const mon = generateDaySlots({
    provider: riverside,
    specialist: rana,
    ymd: monday,
    originYmd: origin,
    closures: [],
    booked: [],
    now: new Date("2026-10-26T00:00:00+07:00"),
  });
  expect(mon.slots.some((s) => s.startTime === "20:00")).toBe(false);
  expect(mon.slots.at(-1)?.endTime).toBe("20:00");
  const fri = generateDaySlots({
    provider: riverside,
    specialist: rana,
    ymd: friday,
    originYmd: origin,
    closures: [],
    booked: [],
    now: new Date("2026-10-26T00:00:00+07:00"),
  });
  expect(fri.reason).toBe("full");
  expect(fri.slots).toHaveLength(0);
});

test("a booked middle slot blocks a party of 2 from starting on the previous slot", () => {
  const { slots } = generateDaySlots({
    provider: riverside,
    specialist: wongsakul,
    ymd: monday,
    originYmd: origin,
    closures: [],
    booked: [
      {
        providerId: 48,
        specialistId: "w",
        dayOffset: 0,
        startTime: "10:40",
      },
    ],
    now: new Date("2026-10-26T00:00:00+07:00"),
    people: 2,
  });
  const ten = slots.find((s) => s.startTime === "10:00")!;
  const forty = slots.find((s) => s.startTime === "10:40")!;
  const twenty = slots.find((s) => s.startTime === "11:20")!;
  expect(ten.startable).toBe(false);
  expect(forty.status).toBe("booked");
  expect(twenty.startable).toBe(true);
});
