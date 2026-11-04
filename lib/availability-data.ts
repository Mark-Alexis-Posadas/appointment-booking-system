import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots, type Slot } from "@/lib/availability";
import { getAvailabilityConfig } from "@/lib/availability";

export type ProviderSlotsResult = { slots: Slot[]; businessTimezone: string } | null;

export async function loadProviderSlots(providerId: string, serviceId: string, date: string, now: Date = new Date()): Promise<ProviderSlotsResult> {
  const config = getAvailabilityConfig();
  const localDate = DateTime.fromISO(date, { zone: config.businessTimezone });
  if (!localDate.isValid) return null;
  const weekday = localDate.weekday % 7;
  const dayStart = localDate.startOf("day").toUTC().toJSDate();
  const dayEnd = localDate.plus({ days: 1 }).startOf("day").toUTC().toJSDate();

  const provider = await prisma.provider.findFirst({
    where: { id: providerId, isActive: true, services: { some: { id: serviceId, isActive: true } } },
    select: { id: true, services: { where: { id: serviceId }, select: { durationMinutes: true } } },
  });
  const service = provider?.services[0];
  if (!provider || !service) return null;

  const [workingHours, timeOff, appointments] = await Promise.all([
    prisma.workingHours.findMany({ where: { providerId, weekday }, select: { weekday: true, startTime: true, endTime: true }, orderBy: { startTime: "asc" } }),
    prisma.timeOff.findMany({ where: { providerId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } }),
    prisma.appointment.findMany({ where: { providerId, status: "BOOKED", startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true, status: true } }),
  ]);

  return {
    businessTimezone: config.businessTimezone,
    slots: getAvailableSlots({ date, serviceDurationMinutes: service.durationMinutes, workingHours, timeOff, appointments, now, config }),
  };
}
