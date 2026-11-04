import { describe, expect, it } from "vitest";
import { buildAdminAppointmentQuery } from "./admin-appointment-query";
import { decideCancellation, decideStatusUpdate } from "./appointment-status";

const now = new Date("2026-01-01T00:00:00Z");
const future = new Date("2026-01-03T00:00:00Z");

describe("appointment management decisions", () => {
  it("allows cancellation outside the cancellation window", () => {
    expect(decideCancellation({ role: "CUSTOMER", ownerMatches: true, status: "BOOKED", startsAt: future, now, cancellationWindowHours: 24 })).toEqual({ allowed: true });
  });

  it("rejects cancellation inside the cancellation window", () => {
    expect(decideCancellation({ role: "CUSTOMER", ownerMatches: true, status: "BOOKED", startsAt: new Date("2026-01-01T12:00:00Z"), now, cancellationWindowHours: 24 })).toMatchObject({ allowed: false, status: 409 });
  });

  it("returns not found when a customer cancels another customer's appointment", () => {
    expect(decideCancellation({ role: "CUSTOMER", ownerMatches: false, status: "BOOKED", startsAt: future, now, cancellationWindowHours: 24 })).toMatchObject({ allowed: false, status: 404 });
  });

  it("enforces one-way status transitions", () => {
    expect(decideStatusUpdate({ role: "ADMIN", ownsProvider: true, current: "BOOKED", next: "COMPLETED", startsAt: future, now })).toEqual({ allowed: true });
    expect(decideStatusUpdate({ role: "ADMIN", ownsProvider: true, current: "CANCELLED", next: "COMPLETED", startsAt: future, now })).toMatchObject({ allowed: false, status: 409 });
  });

  it("rejects provider completion before the appointment starts", () => {
    expect(decideStatusUpdate({ role: "STAFF", ownsProvider: true, current: "BOOKED", next: "COMPLETED", startsAt: future, now })).toMatchObject({ allowed: false, status: 409 });
  });

  it("hides another provider's appointment from STAFF", () => {
    expect(decideStatusUpdate({ role: "STAFF", ownsProvider: false, current: "BOOKED", next: "NO_SHOW", startsAt: now, now })).toMatchObject({ allowed: false, status: 404 });
  });
});

describe("admin appointment pagination and filters", () => {
  it("builds server pagination and combined filters", () => {
    const query = buildAdminAppointmentQuery({ page: 3, dateFrom: "2026-01-05", dateTo: "2026-01-06", providerId: "provider-1", serviceId: "service-1", status: "BOOKED", search: "Casey" }, "Asia/Manila");
    expect(query.skip).toBe(40);
    expect(query.take).toBe(20);
    expect(query.where.providerId).toBe("provider-1");
    expect(query.where.serviceId).toBe("service-1");
    expect(query.where.status).toBe("BOOKED");
    const dateRange = query.where.startsAt as { gte?: Date; lt?: Date };
    expect(dateRange.gte?.toISOString()).toBe("2026-01-04T16:00:00.000Z");
    expect(dateRange.lt?.toISOString()).toBe("2026-01-06T16:00:00.000Z");
    expect(query.where.customer?.is?.OR).toHaveLength(2);
  });
});
