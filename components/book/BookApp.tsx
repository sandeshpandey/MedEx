"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDevOffline } from "@/components/DevPanel";
import type { DayReason, Slot } from "@/lib/slots";
import { formatDate, formatTime, wallToUtc } from "@/lib/timezone";

type ListedProvider = {
  id: number;
  name: string;
  country: string;
  timezone: { iana: string; source: string; original: string };
  specialists: { id: string; name: string; speciality: string }[];
};

type DayInfo = { ymd: string; reason: DayReason; reasonText: string };

type CalendarRes = {
  origin: string;
  timezone: { iana: string; source: string; original: string };
  days: DayInfo[];
};

type SlotsRes = {
  reason: DayReason;
  reasonText: string;
  slots: Slot[];
  clipped: boolean;
  open: { startTime: string; endTime: string } | null;
  timezone: { iana: string; source: string; original: string };
};

type Existing = {
  bookingId: string;
  providerId: number;
  specialistId: string;
  ymd: string;
  startTime: string;
  numberOfPeople: number;
  providerName: string;
  specialistName: string;
};

const REASON_LABEL: Record<DayReason, string> = {
  ok: "Available",
  past: "Past",
  closed: "Closed",
  holiday: "Holiday",
  full: "No free slots",
};

function period(start: string): "Morning" | "Afternoon" | "Evening" {
  const h = Number(start.slice(0, 2));
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

function weekdayIndex(ymd: string, tz: string): number {
  const utc = wallToUtc(ymd, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(utc);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
}

export function BookApp({ reschedule }: { reschedule?: boolean }) {
  const offline = useDevOffline();
  const customerTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const [providers, setProviders] = useState<ListedProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [specialistId, setSpecialistId] = useState<string>("");
  const [people, setPeople] = useState(1);
  const [calendar, setCalendar] = useState<CalendarRes | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [ymd, setYmd] = useState<string>("");
  const [day, setDay] = useState<SlotsRes | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [picked, setPicked] = useState<string>("");
  const [existing, setExisting] = useState<Existing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);

  const provider = providers?.find((p) => p.id === providerId) ?? null;
  const specialist = provider?.specialists.find((s) => s.id === specialistId);

  const loadProviders = useCallback(async () => {
    setError(null);
    try {
      const res = await api<{ providers: ListedProvider[] }>("/api/book/providers");
      setProviders(res.providers);
      if (reschedule) {
        const first = res.providers.find((p) => p.id === 48) ?? res.providers[0];
        if (!first) return;
        const detail = await api<{ existingBooking: Existing }>(
          `/api/book/providers/${first.id}`,
        );
        setExisting(detail.existingBooking);
        setProviderId(detail.existingBooking.providerId);
        setSpecialistId(detail.existingBooking.specialistId);
        setPeople(detail.existingBooking.numberOfPeople);
      } else if (res.providers[0]) {
        setProviderId(res.providers[0].id);
        setSpecialistId(res.providers[0].specialists[0]?.id ?? "");
      }
    } catch {
      setError("Could not load clinics.");
    }
  }, [reschedule]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!providerId || !specialistId) return;
    const ac = new AbortController();
    setCalLoading(true);
    setCalendar(null);
    setDay(null);
    setPicked("");
    void api<CalendarRes>(
      `/api/book/providers/${providerId}/slots?specialistId=${specialistId}&people=${people}`,
    )
      .then((res) => {
        if (ac.signal.aborted) return;
        setCalendar(res);
        const firstOk = res.days.find((d) => d.reason === "ok");
        setYmd(existing && reschedule ? existing.ymd : (firstOk?.ymd ?? ""));
      })
      .catch(() => {
        if (!ac.signal.aborted) setError("Could not load availability.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setCalLoading(false);
      });
    return () => ac.abort();
  }, [providerId, specialistId, people, existing, reschedule]);

  useEffect(() => {
    if (!providerId || !specialistId || !ymd) return;
    setDayLoading(true);
    void api<SlotsRes>(
      `/api/book/providers/${providerId}/slots?specialistId=${specialistId}&date=${ymd}&people=${people}`,
    )
      .then(setDay)
      .catch(() => setError("Could not load times."))
      .finally(() => setDayLoading(false));
  }, [providerId, specialistId, ymd, people]);

  const months = useMemo(() => {
    if (!calendar) return [];
    const map = new Map<string, DayInfo[]>();
    for (const d of calendar.days) {
      const k = monthKey(d.ymd);
      const list = map.get(k);
      if (list) list.push(d);
      else map.set(k, [d]);
    }
    return [...map.entries()];
  }, [calendar]);

  const groups = useMemo(() => {
    if (!day) return [];
    const order = ["Morning", "Afternoon", "Evening"] as const;
    return order
      .map((label) => ({
        label,
        slots: day.slots.filter((s) => period(s.startTime) === label),
      }))
      .filter((g) => g.slots.length);
  }, [day]);

  const tz = provider?.timezone.iana ?? calendar?.timezone.iana ?? "UTC";

  function onCalendarKey(e: React.KeyboardEvent, days: DayInfo[]) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const i = days.findIndex((d) => d.ymd === ymd);
    const delta =
      e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -7 : 7;
    const next = days[i + delta];
    if (next) {
      setYmd(next.ymd);
      setPicked("");
    }
  }

  async function confirm() {
    if (!providerId || !specialistId || !ymd || !picked) return;
    setConfirming(true);
    setMessage(null);
    setUnknown(false);
    try {
      if (reschedule && existing) {
        const res = await api<{ bookingId: string }>(`/api/book/bookings/${existing.bookingId}`, {
          method: "PUT",
          body: JSON.stringify({ date: ymd, startTime: picked }),
        });
        setDone(res.bookingId);
      } else {
        const res = await api<{ bookingId: string }>("/api/book/bookings", {
          method: "POST",
          body: JSON.stringify({
            providerId,
            specialistId,
            date: ymd,
            startTime: picked,
            numberOfPeople: people,
          }),
        });
        setDone(res.bookingId);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setUnknown(true);
        setMessage("We could not confirm the booking. Check your connection before trying again.");
      } else if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { message?: string; alternatives?: string[] };
        setMessage(body.message ?? "That time was just taken.");
        setAlternatives(body.alternatives ?? []);
      } else {
        setMessage("Something went wrong. You can retry without losing your selection.");
      }
    } finally {
      setConfirming(false);
    }
  }

  if (error && !providers) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <p>{error}</p>
        <button type="button" className="mt-2 underline" onClick={() => void loadProviders()}>
          Try again
        </button>
      </main>
    );
  }

  if (!providers) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-xl bg-[var(--line)]" />
      </main>
    );
  }

  if (done) {
    return (
      <main id="main" className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold">
          {reschedule ? "Appointment updated" : "Appointment booked"}
        </h1>
        <p className="mt-2">
          Reference {done}. {formatDate(ymd, tz)} at {picked} clinic time (
          {formatTime(wallToUtc(ymd, picked, tz), customerTz)} your time).
        </p>
        <Link href="/book" className="mt-4 inline-block underline">
          Book another
        </Link>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        {reschedule ? "Reschedule appointment" : "Book an appointment"}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Times are shown in the clinic’s clock, with yours underneath. You need to be at the
        clinic at the clinic time.
      </p>
      {reschedule && existing ? (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
          Current: {existing.specialistName} at {existing.providerName}, {existing.ymd}{" "}
          {existing.startTime} clinic time.
        </p>
      ) : (
        <p className="mt-3 text-sm">
          <Link href="/book/reschedule" className="underline">
            Reschedule the sample booking
          </Link>
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Clinic
          <select
            className="mt-1 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5"
            value={providerId ?? ""}
            disabled={reschedule}
            onChange={(e) => {
              const id = Number(e.target.value);
              setProviderId(id);
              const p = providers.find((x) => x.id === id);
              setSpecialistId(p?.specialists[0]?.id ?? "");
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Specialist
          <select
            className="mt-1 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5"
            value={specialistId}
            disabled={reschedule}
            onChange={(e) => setSpecialistId(e.target.value)}
          >
            {provider?.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.speciality}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          People
          <select
            className="mt-1 w-full rounded border border-[var(--line)] bg-white px-2 py-1.5"
            value={people}
            disabled={reschedule}
            onChange={(e) => setPeople(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {provider ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Clinic zone {tz}
          {provider.timezone.source === "country"
            ? ` (from country code; stored value was “${provider.timezone.original || "empty"}”)`
            : provider.timezone.original !== tz
              ? ` (stored as “${provider.timezone.original}”)`
              : ""}
          . Your zone {customerTz}.
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="font-semibold">Date</h2>
        {calLoading ? (
          <div className="mt-3 h-56 animate-pulse rounded-xl bg-[var(--line)]" />
        ) : calendar && !calendar.days.some((d) => d.reason === "ok") ? (
          <p className="mt-3 text-sm">
            {specialist?.name} has no free slots in the next 90 days. Choose another
            specialist, or another clinic.
          </p>
        ) : (
          <div className="mt-3 space-y-6">
            {months.map(([key, days]) => {
              const pad = Math.max(0, weekdayIndex(days[0].ymd, tz));
              return (
                <div key={key}>
                  <h3 className="text-sm font-medium">
                    {new Intl.DateTimeFormat("en-GB", {
                      month: "long",
                      year: "numeric",
                      timeZone: tz,
                    }).format(wallToUtc(days[0].ymd, "12:00", tz))}
                  </h3>
                  <div
                    className="mt-2 grid grid-cols-7 gap-1"
                    role="grid"
                    aria-label="Appointment calendar"
                    onKeyDown={(e) => onCalendarKey(e, calendar?.days ?? [])}
                  >
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <div key={d} className="text-center text-xs text-[var(--muted)]">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: pad }, (_, i) => (
                      <div key={`pad-${i}`} />
                    ))}
                    {days.map((d) => {
                      const disabled = d.reason !== "ok";
                      const selected = d.ymd === ymd;
                      return (
                        <button
                          key={d.ymd}
                          type="button"
                          role="gridcell"
                          tabIndex={selected ? 0 : -1}
                          disabled={disabled}
                          title={disabled ? d.reasonText : REASON_LABEL[d.reason]}
                          aria-label={`${d.ymd}, ${REASON_LABEL[d.reason]}${d.reasonText ? `: ${d.reasonText}` : ""}`}
                          aria-selected={selected}
                          className={`rounded px-1 py-2 text-sm ${
                            selected
                              ? "bg-[var(--accent)] text-white"
                              : disabled
                                ? "text-[var(--disabled)] line-through"
                                : "bg-white hover:border-[var(--accent)]"
                          } border border-[var(--line)]`}
                          onClick={() => {
                            setYmd(d.ymd);
                            setPicked("");
                            setMessage(null);
                          }}
                        >
                          {Number(d.ymd.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Time</h2>
        {day?.clipped ? (
          <p className="mt-2 text-sm text-[var(--warn)]">
            Some of {specialist?.name}’s advertised hours fall outside clinic opening hours
            {day.open ? ` (${day.open.startTime}–${day.open.endTime})` : ""}. Only the overlap is
            offered.
          </p>
        ) : null}
        {dayLoading ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-[var(--line)]" />
        ) : day && day.slots.length === 0 ? (
          <p className="mt-3 text-sm">
            {day.reasonText || "No times this day."}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                const next = calendar?.days.find((d) => d.reason === "ok" && d.ymd > ymd);
                if (next) setYmd(next.ymd);
              }}
            >
              Jump to the next open day
            </button>
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mt-4">
              <h3 className="text-sm font-medium">{g.label}</h3>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role="listbox"
                aria-label={`${g.label} times`}
                onKeyDown={(e) => {
                  const startable = g.slots.filter((s) => s.startable);
                  const i = startable.findIndex((s) => s.startTime === picked);
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const n = startable[i + 1] ?? startable[0];
                    if (n) setPicked(n.startTime);
                  }
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const n = startable[i - 1] ?? startable.at(-1);
                    if (n) setPicked(n.startTime);
                  }
                }}
              >
                {g.slots.map((s) => {
                  const start = new Date(s.startUtc);
                  const yours = formatTime(start, customerTz);
                  const disabled = !s.startable;
                  return (
                    <button
                      key={s.startTime}
                      type="button"
                      role="option"
                      aria-selected={picked === s.startTime}
                      disabled={disabled}
                      className={`min-w-[7.5rem] rounded border px-2 py-2 text-left text-sm ${
                        picked === s.startTime
                          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                          : "border-[var(--line)] bg-white"
                      } ${disabled ? "opacity-50" : ""}`}
                      onClick={() => {
                        setPicked(s.startTime);
                        setMessage(null);
                        setAlternatives([]);
                      }}
                    >
                      <span className="block font-semibold">{s.startTime} clinic</span>
                      <span className="block text-xs opacity-80">{yours} your time</span>
                      {s.status === "booked" ? (
                        <span className="block text-xs">Taken</span>
                      ) : s.status === "past" ? (
                        <span className="block text-xs">Already started</span>
                      ) : people > 1 && !s.startable ? (
                        <span className="block text-xs">Not enough consecutive slots</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {picked && ymd ? (
        <section className="mt-8 rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Confirm</h2>
          {reschedule && existing ? (
            <p className="mt-2 text-sm">
              From <strong>{existing.ymd} {existing.startTime}</strong> clinic time to{" "}
              <strong>{ymd} {picked}</strong> clinic time (
              {formatTime(wallToUtc(ymd, picked, tz), customerTz)} for you).
            </p>
          ) : (
            <p className="mt-2 text-sm">
              {specialist?.name} at {provider?.name} on {formatDate(ymd, tz)}, {picked} clinic
              time / {formatTime(wallToUtc(ymd, picked, tz), customerTz)} your time, for {people}{" "}
              {people === 1 ? "person" : "people"}.
            </p>
          )}
          {message ? <p className="mt-2 text-sm text-[var(--danger)]">{message}</p> : null}
          {alternatives.length ? (
            <p className="mt-2 text-sm">
              Closest free starts:{" "}
              {alternatives.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="mr-2 underline"
                  onClick={() => setPicked(t)}
                >
                  {t}
                </button>
              ))}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 rounded bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-50"
            disabled={confirming || offline || unknown}
            onClick={() => void confirm()}
          >
            {confirming ? "Booking…" : reschedule ? "Confirm new time" : "Confirm booking"}
          </button>
          {offline ? (
            <p className="mt-2 text-sm text-[var(--warn)]">You are offline. Booking is paused.</p>
          ) : null}
          {unknown ? (
            <p className="mt-2 text-sm">
              Result unknown.{" "}
              <button type="button" className="underline" onClick={() => setUnknown(false)}>
                Retry
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
    </main>
  );
}
