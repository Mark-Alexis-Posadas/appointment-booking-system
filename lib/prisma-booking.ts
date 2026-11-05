import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { BookingExecutor, BookingTransaction } from "@/lib/booking";

export async function lockProviderRows(tx: Prisma.TransactionClient, providerIds: readonly string[]): Promise<string[]> {
  const ids = [...new Set(providerIds)].sort();
  if (ids.length === 0) return [];
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Provider" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
  return rows.map(({ id }) => id);
}

export async function lockServiceRows(tx: Prisma.TransactionClient, serviceIds: readonly string[]): Promise<string[]> {
  const ids = [...new Set(serviceIds)].sort();
  if (ids.length === 0) return [];
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Service" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
  return rows.map(({ id }) => id);
}

export const executePrismaBooking: BookingExecutor = async <T>(operation: (transaction: BookingTransaction) => Promise<T>) => prisma.$transaction(async (tx) => {
  const transaction: BookingTransaction = {
    async lockProviders(providerIds) {
      const ids = [...new Set(providerIds)].sort();
      if (ids.length === 0) return true;
      const lockedIds = await lockProviderRows(tx, ids);
      return lockedIds.length === ids.length;
    },
    async lockCustomer(customerId) {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${customerId} FOR UPDATE`);
      return rows.length > 0;
    },
    async getActiveProviderService(providerId, serviceId) {
      const provider = await tx.provider.findFirst({
        where: { id: providerId, isActive: true, services: { some: { id: serviceId, isActive: true } } },
        select: { user: { select: { name: true } }, services: { where: { id: serviceId }, select: { id: true, name: true, durationMinutes: true, price: true } } },
      });
      const service = provider?.services[0];
      if (!provider || !service) return null;
      return { providerId, providerName: provider.user.name, serviceId: service.id, serviceName: service.name, serviceDurationMinutes: service.durationMinutes, servicePrice: service.price.toString() };
    },
    getWorkingHours(providerId, weekday) {
      return tx.workingHours.findMany({ where: { providerId, weekday }, select: { weekday: true, startTime: true, endTime: true }, orderBy: { startTime: "asc" } });
    },
    getTimeOff(providerId, dayStart, dayEnd) {
      return tx.timeOff.findMany({ where: { providerId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } });
    },
    getBookedAppointments(providerId, dayStart, dayEnd, excludeAppointmentId) {
      return tx.appointment.findMany({ where: { providerId, status: "BOOKED", id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true, status: true } });
    },
    async hasCustomerOverlap(customerId, startsAt, endsAt, excludeAppointmentId) {
      const overlapping = await tx.appointment.findFirst({ where: { customerId, status: "BOOKED", id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true } });
      return overlapping !== null;
    },
    createAppointment(customerId, providerId, serviceId, startsAt, endsAt) {
      return tx.appointment.create({ data: { customerId, providerId, serviceId, startsAt, endsAt, status: "BOOKED" }, select: appointmentSelection }).then(toCreatedAppointment);
    },
    async getOwnedAppointmentForUpdate(appointmentId, customerId, lock = true) {
      if (lock) await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "id" = ${appointmentId} AND "customerId" = ${customerId} FOR UPDATE`);
      const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, customerId }, select: { id: true, customerId: true, providerId: true, serviceId: true, startsAt: true, endsAt: true, status: true } });
      return appointment ? { ...appointment, status: appointment.status } : null;
    },
    updateAppointmentTime(appointmentId, startsAt, endsAt) {
      return tx.appointment.update({ where: { id: appointmentId }, data: { startsAt, endsAt }, select: appointmentSelection }).then(toCreatedAppointment);
    },
  };
  return operation(transaction);
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

const appointmentSelection = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  provider: { select: { user: { select: { name: true } } } },
  service: { select: { name: true, price: true } },
} as const;

function toCreatedAppointment(created: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  provider: { user: { name: string } };
  service: { name: string; price: { toString(): string } };
}) {
  return { id: created.id, startsAt: created.startsAt, endsAt: created.endsAt, status: created.status, provider: { name: created.provider.user.name }, service: { name: created.service.name, price: created.service.price.toString() } };
}
