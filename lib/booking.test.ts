import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingError, createBooking, isProviderOverlapConstraintError, rescheduleBooking, type BookingExecutor, type BookingService, type BookingTransaction, type CreatedAppointment, type ReschedulableAppointment } from "./booking";
import { Prisma } from "@/generated/prisma";
import type { AppointmentInput, AvailabilityConfig, TimedIntervalInput, WorkingHourInput } from "./availability";

const authStub = vi.hoisted(() => ({ auth: vi.fn<() => Promise<unknown>>() }));
vi.mock("@/auth", () => ({ auth: authStub.auth }));

const config: AvailabilityConfig = { businessTimezone: "Asia/Manila", slotIntervalMinutes: 15, minNoticeHours: 0, maxAdvanceDays: 60 };
const request = { customerId: "customer-1", providerId: "provider-1", serviceId: "service-1", startsAt: "2026-01-05T01:00:00Z" };
const service: BookingService = { providerId: "provider-1", providerName: "Provider One", serviceId: "service-1", serviceName: "Consultation", serviceDurationMinutes: 30, servicePrice: "25.00" };
const hours: WorkingHourInput[] = [{ weekday: 1, startTime: "09:00", endTime: "10:00" }];

describe("provider overlap constraint error classification", () => {
  const knownError = (code: string, meta: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError("database error", { code, clientVersion: "test", meta });

  it("recognizes the named PostgreSQL provider overlap exclusion", () => {
    expect(isProviderOverlapConstraintError(knownError("P2004", { constraint: "Appointment_provider_no_booked_overlap" }))).toBe(true);
    expect(isProviderOverlapConstraintError(knownError("P2004", { code: "23P01" }))).toBe(true);
  });

  it("does not classify unrelated P2004 errors or different Prisma codes as slot conflicts", () => {
    expect(isProviderOverlapConstraintError(knownError("P2004", { constraint: "some_other_constraint" }))).toBe(false);
    expect(isProviderOverlapConstraintError(knownError("P2034", { code: "23P01" }))).toBe(false);
  });
});

function makeExecutor(options: { active?: boolean; hours?: WorkingHourInput[]; timeOff?: TimedIntervalInput[]; appointments?: AppointmentInput[]; customerOverlap?: boolean } = {}) {
  const state = { appointments: [...(options.appointments ?? [])] };
  const execute: BookingExecutor = async <T>(operation: (transaction: BookingTransaction) => Promise<T>): Promise<T> => operation({
    async lockProviders() { return true; },
    async lockCustomer() { return true; },
    async getActiveProviderService() { return options.active === false ? null : service; },
    async getWorkingHours() { return options.hours ?? hours; },
    async getTimeOff() { return options.timeOff ?? []; },
    async getBookedAppointments() { return state.appointments.filter((appointment) => appointment.status === "BOOKED"); },
    async hasCustomerOverlap() { return options.customerOverlap ?? false; },
    async createAppointment(customerId, providerId, serviceId, startsAt, endsAt): Promise<CreatedAppointment> {
      const overlaps = state.appointments.some((appointment) => appointment.status === "BOOKED" && startsAt < new Date(appointment.endsAt) && endsAt > new Date(appointment.startsAt));
      if (overlaps) throw new BookingError("That slot is no longer available.", 409);
      state.appointments.push({ status: "BOOKED", startsAt, endsAt });
      return { id: `appointment-${state.appointments.length}`, startsAt, endsAt, status: "BOOKED", provider: { name: service.providerName }, service: { name: service.serviceName, price: service.servicePrice } };
    },
  });
  return { execute, state };
}

describe("createBooking", () => {
  beforeEach(() => authStub.auth.mockReset());

  it("creates a booking and calculates its end time on the server", async () => {
    const { execute } = makeExecutor();
    const result = await createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"));
    expect(result.status).toBe("BOOKED");
    expect(result.endsAt.toISOString()).toBe("2026-01-05T01:30:00.000Z");
    expect(result.service.name).toBe("Consultation");
  });

  it("rejects a slot outside working hours with 409", async () => {
    const { execute } = makeExecutor();
    await expect(createBooking({ ...request, startsAt: "2026-01-05T02:00:00Z" }, execute, config, new Date("2026-01-04T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a slot already taken with 409", async () => {
    const { execute } = makeExecutor({ appointments: [{ status: "BOOKED", startsAt: "2026-01-05T01:00:00Z", endsAt: "2026-01-05T01:30:00Z" }] });
    await expect(createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
  });

  it("rejects an overlapping appointment with a different start time", async () => {
    const { execute } = makeExecutor({ appointments: [{ status: "BOOKED", startsAt: "2026-01-05T01:15:00Z", endsAt: "2026-01-05T01:45:00Z" }] });
    await expect(createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
  });

  it("allows rebooking after a prior appointment was cancelled", async () => {
    const { execute } = makeExecutor({ appointments: [{ status: "CANCELLED", startsAt: "2026-01-05T01:00:00Z", endsAt: "2026-01-05T01:30:00Z" }] });
    const result = await createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"));
    expect(result.status).toBe("BOOKED");
  });

  it("rejects inactive or unavailable providers and services", async () => {
    const { execute } = makeExecutor({ active: false });
    await expect(createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"))).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a customer overlap even with a different provider", async () => {
    const { execute } = makeExecutor({ customerOverlap: true });
    await expect(createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z"))).rejects.toMatchObject({ status: 409 });
  });

  it("allows only one of two concurrent requests for the same slot", async () => {
    const { execute } = makeExecutor();
    const results = await Promise.allSettled([
      createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z")),
      createBooking(request, execute, config, new Date("2026-01-04T00:00:00Z")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason instanceof BookingError && result.reason.status === 409)).toHaveLength(1);
  });
});

describe("POST /api/appointments authentication", () => {
  it("returns 401 for an unauthenticated request", async () => {
    authStub.auth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/appointments/route");
    const response = await POST(new Request("http://localhost/api/appointments", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });
});

function makeRescheduleExecutor(otherAppointments: Array<{ id: string; status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"; startsAt: Date; endsAt: Date }> = []) {
  const original: ReschedulableAppointment = { id: "appointment-old", customerId: request.customerId, providerId: request.providerId, serviceId: request.serviceId, startsAt: new Date("2026-01-05T01:00:00Z"), endsAt: new Date("2026-01-05T01:30:00Z"), status: "BOOKED" };
  const state = { current: original, others: otherAppointments };
  const execute: BookingExecutor = async <T>(operation: (transaction: BookingTransaction) => Promise<T>): Promise<T> => operation({
    async lockProviders() { return true; },
    async lockCustomer() { return true; },
    async getActiveProviderService() { return service; },
    async getWorkingHours() { return [{ weekday: 1, startTime: "09:00", endTime: "11:00" }]; },
    async getTimeOff() { return []; },
    async getBookedAppointments(_providerId, _dayStart, _dayEnd, excludeId) { return state.others.filter((item) => item.id !== excludeId && item.status === "BOOKED"); },
    async hasCustomerOverlap(_customerId, startsAt, endsAt, excludeId) { return state.others.some((item) => item.id !== excludeId && item.status === "BOOKED" && startsAt < item.endsAt && endsAt > item.startsAt); },
    async createAppointment(): Promise<CreatedAppointment> { throw new Error("not used"); },
    async getOwnedAppointmentForUpdate(id, customerId) { return id === state.current.id && customerId === state.current.customerId ? state.current : null; },
    async updateAppointmentTime(_id, startsAt, endsAt) {
      if (state.others.some((item) => item.status === "BOOKED" && startsAt < item.endsAt && endsAt > item.startsAt)) throw new BookingError("That slot is no longer available.", 409);
      state.current = { ...state.current, startsAt, endsAt };
      return { id: state.current.id, startsAt, endsAt, status: "BOOKED", provider: { name: service.providerName }, service: { name: service.serviceName, price: service.servicePrice } };
    },
  });
  return { execute, state };
}

describe("rescheduleBooking", () => {
  const originalNow = new Date("2026-01-04T00:00:00Z");
  const move = (startsAt: string, execute: BookingExecutor) => rescheduleBooking({ customerId: request.customerId, appointmentId: "appointment-old", startsAt }, execute, config, 24, originalNow);

  it("reschedules successfully and atomically updates the original appointment", async () => {
    const { execute, state } = makeRescheduleExecutor();
    const result = await move("2026-01-05T01:30:00Z", execute);
    expect(result.startsAt.toISOString()).toBe("2026-01-05T01:30:00.000Z");
    expect(state.current.startsAt.toISOString()).toBe("2026-01-05T01:30:00.000Z");
  });

  it("rejects a taken slot and leaves the original appointment intact", async () => {
    const { execute, state } = makeRescheduleExecutor([{ id: "other", status: "BOOKED", startsAt: new Date("2026-01-05T01:30:00Z"), endsAt: new Date("2026-01-05T02:00:00Z") }]);
    await expect(move("2026-01-05T01:30:00Z", execute)).rejects.toMatchObject({ status: 409 });
    expect(state.current.startsAt.toISOString()).toBe("2026-01-05T01:00:00.000Z");
  });

  it("allows moving into a slot overlapping its own old time", async () => {
    const { execute, state } = makeRescheduleExecutor();
    const result = await move("2026-01-05T01:15:00Z", execute);
    expect(result.startsAt.toISOString()).toBe("2026-01-05T01:15:00.000Z");
    expect(state.current.endsAt.toISOString()).toBe("2026-01-05T01:45:00.000Z");
  });
});
