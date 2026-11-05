import { describe, expect, it } from "vitest";
import { findAppointmentsOutsideSchedule, getAvailableSlots, type AvailabilityConfig, type WorkingHourInput } from "./availability";

const config: AvailabilityConfig = { businessTimezone: "Asia/Manila", slotIntervalMinutes: 15, minNoticeHours: 0, maxAdvanceDays: 60 };
const monday = "2026-01-05";
const hours = (startTime: string, endTime: string, weekday = 1): WorkingHourInput => ({ weekday, startTime, endTime });
const input = (overrides: Partial<Parameters<typeof getAvailableSlots>[0]> = {}) => ({
  date: monday,
  serviceDurationMinutes: 30,
  workingHours: [hours("09:00", "10:00")],
  timeOff: [],
  appointments: [],
  now: "2026-01-04T00:00:00.000Z",
  config,
  ...overrides,
});

describe("findAppointmentsOutsideSchedule", () => {
  it("detects booked intervals outside proposed local working ranges", () => {
    const appointments = [
      { id: "inside", startsAt: new Date("2026-01-05T01:00:00Z"), endsAt: new Date("2026-01-05T01:30:00Z") },
      { id: "outside", startsAt: new Date("2026-01-05T03:30:00Z"), endsAt: new Date("2026-01-05T04:00:00Z") },
    ];
    expect(findAppointmentsOutsideSchedule(appointments, [{ weekday: 1, ranges: [{ startTime: "09:00", endTime: "10:00" }] }], "Asia/Manila").map(({ id }) => id)).toEqual(["outside"]);
  });
});
const starts = (result: ReturnType<typeof getAvailableSlots>) => result.map((slot) => slot.startsAt);

describe("getAvailableSlots", () => {
  it("generates starts for a normal day and single range as UTC instants", () => {
    const result = getAvailableSlots(input());
    expect(starts(result)).toEqual(["2026-01-05T01:00:00Z", "2026-01-05T01:15:00Z", "2026-01-05T01:30:00Z"]);
    expect(result[0]?.endsAt).toBe("2026-01-05T01:30:00Z");
  });

  it("keeps a split shift split across its lunch break", () => {
    const result = getAvailableSlots(input({ workingHours: [hours("09:00", "12:00"), hours("13:00", "17:00")] }));
    expect(result).toHaveLength(26);
    expect(result.some((slot) => slot.startsAt === "2026-01-05T04:45:00Z")).toBe(false);
    expect(result.some((slot) => slot.startsAt === "2026-01-05T05:00:00Z")).toBe(true);
  });

  it("returns no slots on a closed day", () => {
    expect(getAvailableSlots(input({ workingHours: [] }))).toEqual([]);
  });

  it("splits a range around a booked appointment", () => {
    const result = getAvailableSlots(input({ appointments: [{ status: "BOOKED", startsAt: "2026-01-05T01:30:00Z", endsAt: "2026-01-05T02:00:00Z" }] }));
    expect(starts(result)).toEqual(["2026-01-05T01:00:00Z"]);
  });

  it("excludes a one-minute overlap and allows back-to-back slots", () => {
    const result = getAvailableSlots(input({ serviceDurationMinutes: 15, workingHours: [hours("09:00", "10:00")], appointments: [{ status: "BOOKED", startsAt: "2026-01-05T01:16:00Z", endsAt: "2026-01-05T01:31:00Z" }] }));
    expect(starts(result)).toEqual(["2026-01-05T01:00:00Z", "2026-01-05T01:45:00Z"]);
    const backToBack = getAvailableSlots(input({ serviceDurationMinutes: 15, workingHours: [hours("09:00", "10:00")], appointments: [{ status: "BOOKED", startsAt: "2026-01-05T01:15:00Z", endsAt: "2026-01-05T01:30:00Z" }] }));
    expect(starts(backToBack)).toEqual(["2026-01-05T01:00:00Z", "2026-01-05T01:30:00Z", "2026-01-05T01:45:00Z"]);
  });

  it("subtracts a partial time-off period", () => {
    const result = getAvailableSlots(input({ timeOff: [{ startsAt: "2026-01-05T01:30:00Z", endsAt: "2026-01-05T02:00:00Z" }] }));
    expect(starts(result)).toEqual(["2026-01-05T01:00:00Z"]);
  });

  it("subtracts time off that covers the whole working day", () => {
    const result = getAvailableSlots(input({ timeOff: [{ startsAt: "2026-01-05T00:00:00Z", endsAt: "2026-01-05T15:59:00Z" }] }));
    expect(result).toEqual([]);
  });

  it("returns no slots when the service is longer than any free window", () => {
    expect(getAvailableSlots(input({ serviceDurationMinutes: 61 }))).toEqual([]);
  });

  it("ignores cancelled appointments", () => {
    const result = getAvailableSlots(input({ appointments: [{ status: "CANCELLED", startsAt: "2026-01-05T01:00:00Z", endsAt: "2026-01-05T02:00:00Z" }] }));
    expect(result).toHaveLength(3);
  });

  it("applies min notice for today", () => {
    const result = getAvailableSlots(input({ date: "2026-01-05", workingHours: [hours("09:00", "12:00")], now: "2026-01-05T00:30:00Z", config: { ...config, minNoticeHours: 2 } }));
    expect(result[0]?.startsAt).toBe("2026-01-05T02:30:00Z");
  });

  it("applies the max advance cutoff", () => {
    const result = getAvailableSlots(input({ date: "2026-03-09", workingHours: [hours("09:00", "10:00")], now: "2026-01-05T01:00:00Z", config: { ...config, maxAdvanceDays: 60 } }));
    expect(result).toEqual([]);
  });

  it("supports durations that are not multiples of the slot interval", () => {
    const result = getAvailableSlots(input({ serviceDurationMinutes: 20, workingHours: [hours("09:00", "10:00")] }));
    expect(starts(result)).toEqual(["2026-01-05T01:00:00Z", "2026-01-05T01:15:00Z", "2026-01-05T01:30:00Z"]);
    expect(result[1]?.endsAt).toBe("2026-01-05T01:35:00Z");
  });

  it("handles a timezone day boundary using Luxon day arithmetic", () => {
    const result = getAvailableSlots(input({ date: "2026-03-08", workingHours: [{ weekday: 0, startTime: "00:00", endTime: "03:00" }], serviceDurationMinutes: 60, now: "2026-03-07T00:00:00Z", config: { ...config, businessTimezone: "America/New_York" } }));
    expect(result[0]?.startsAt).toBe("2026-03-08T05:00:00Z");
    expect(result.some((slot) => slot.startsAt === "2026-03-08T06:00:00Z")).toBe(true);
    expect(result.some((slot) => slot.startsAt === "2026-03-08T07:00:00Z")).toBe(false);
  });
});
