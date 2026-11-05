import { DateTime } from "luxon";

export type WorkingHourInput = { weekday: number; startTime: string; endTime: string };
export type TimedIntervalInput = { startsAt: Date | string; endsAt: Date | string };
export type AppointmentInput = TimedIntervalInput & { status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW" };
export type Slot = { startsAt: string; endsAt: string };
export type AvailabilityConfig = { businessTimezone: string; slotIntervalMinutes: number; minNoticeHours: number; maxAdvanceDays: number };
export type ProposedWorkingDay = { weekday: number; ranges: readonly { startTime: string; endTime: string }[] };

export type GetAvailableSlotsInput = {
  date: string;
  serviceDurationMinutes: number;
  workingHours: readonly WorkingHourInput[];
  timeOff: readonly TimedIntervalInput[];
  appointments: readonly AppointmentInput[];
  now: Date | string;
  config: AvailabilityConfig;
};

type Interval = { start: number; end: number };

export function findAppointmentsOutsideSchedule(appointments: readonly { id: string; startsAt: Date; endsAt: Date }[], days: readonly ProposedWorkingDay[], timezone: string) {
  const byWeekday = new Map(days.map((day) => [day.weekday, day.ranges]));
  return appointments.filter((appointment) => {
    const start = DateTime.fromJSDate(appointment.startsAt, { zone: "utc" }).setZone(timezone);
    const end = DateTime.fromJSDate(appointment.endsAt, { zone: "utc" }).setZone(timezone);
    if (!start.isValid || !end.isValid || start.toISODate() !== end.toISODate()) return true;
    return !(byWeekday.get(start.weekday % 7) ?? []).some((range) => {
      const rangeStart = DateTime.fromISO(`${start.toISODate()}T${range.startTime}`, { zone: timezone });
      const rangeEnd = DateTime.fromISO(`${start.toISODate()}T${range.endTime}`, { zone: timezone });
      return rangeStart.isValid && rangeEnd.isValid && start.toMillis() >= rangeStart.toMillis() && end.toMillis() <= rangeEnd.toMillis();
    });
  });
}

function timestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals.filter((interval) => interval.end > interval.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return merged;
}

function localRange(date: string, time: string, timezone: string): DateTime | null {
  const result = DateTime.fromISO(`${date}T${time}`, { zone: timezone, setZone: true });
  return result.isValid ? result.toUTC() : null;
}

export function getAvailableSlots(input: GetAvailableSlotsInput): Slot[] {
  const { date, serviceDurationMinutes, workingHours, timeOff, appointments, now, config } = input;
  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0 || !Number.isInteger(config.slotIntervalMinutes) || config.slotIntervalMinutes <= 0) return [];
  const localDay = DateTime.fromISO(date, { zone: config.businessTimezone });
  const current = DateTime.fromJSDate(now instanceof Date ? now : new Date(now));
  if (!localDay.isValid || !current.isValid) return [];

  const dayStart = localDay.startOf("day").toUTC().toMillis();
  const dayEnd = localDay.plus({ days: 1 }).startOf("day").toUTC().toMillis();
  const earliestStart = current.plus({ hours: config.minNoticeHours }).toMillis();
  const latestStart = current.plus({ days: config.maxAdvanceDays }).toMillis();
  const durationMs = serviceDurationMinutes * 60_000;
  const intervalMs = config.slotIntervalMinutes * 60_000;
  const weekday = localDay.weekday % 7;

  const ranges = workingHours.filter((hours) => hours.weekday === weekday).flatMap((hours): Interval[] => {
    const start = localRange(date, hours.startTime, config.businessTimezone);
    const end = localRange(date, hours.endTime, config.businessTimezone);
    if (!start || !end || end.toMillis() <= start.toMillis()) return [];
    const clipped = { start: Math.max(dayStart, start.toMillis()), end: Math.min(dayEnd, end.toMillis()) };
    return clipped.end > clipped.start ? [clipped] : [];
  });

  const blockers = mergeIntervals([
    ...timeOff.map((period) => ({ start: timestamp(period.startsAt), end: timestamp(period.endsAt) })),
    ...appointments.filter((appointment) => appointment.status === "BOOKED").map((appointment) => ({ start: timestamp(appointment.startsAt), end: timestamp(appointment.endsAt) })),
  ].filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > dayStart && interval.start < dayEnd).map((interval) => ({ start: Math.max(dayStart, interval.start), end: Math.min(dayEnd, interval.end) })));

  const slots: Slot[] = [];
  for (const range of ranges) {
    for (let start = range.start; start + durationMs <= range.end; start += intervalMs) {
      const end = start + durationMs;
      if (start < earliestStart || start > latestStart) continue;
      if (blockers.some((busy) => start < busy.end && end > busy.start)) continue;
      slots.push({ startsAt: DateTime.fromMillis(start, { zone: "utc" }).toISO({ suppressMilliseconds: true })!, endsAt: DateTime.fromMillis(end, { zone: "utc" }).toISO({ suppressMilliseconds: true })! });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getAvailabilityConfig(env: NodeJS.ProcessEnv = process.env): AvailabilityConfig {
  const positiveInteger = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const nonNegativeInteger = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    businessTimezone: env.BUSINESS_TIMEZONE || "Asia/Manila",
    slotIntervalMinutes: positiveInteger(env.SLOT_INTERVAL_MINUTES, 15),
    minNoticeHours: nonNegativeInteger(env.MIN_NOTICE_HOURS, 2),
    maxAdvanceDays: positiveInteger(env.MAX_ADVANCE_DAYS, 60),
  };
}
