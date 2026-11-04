import { DateTime } from "luxon";
import type { Prisma } from "@/generated/prisma";

export type AdminAppointmentFilters = { page: number; dateFrom?: string; dateTo?: string; providerId?: string; serviceId?: string; status?: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"; search?: string };
export function buildAdminAppointmentQuery(filters: AdminAppointmentFilters, timezone: string): { where: Prisma.AppointmentWhereInput; skip: number; take: 20 } {
  const startsAt: { gte?: Date; lt?: Date } = {};
  if (filters.dateFrom) startsAt.gte = DateTime.fromISO(filters.dateFrom, { zone: timezone }).startOf("day").toUTC().toJSDate();
  if (filters.dateTo) startsAt.lt = DateTime.fromISO(filters.dateTo, { zone: timezone }).plus({ days: 1 }).startOf("day").toUTC().toJSDate();
  return {
    where: {
      ...(Object.keys(startsAt).length ? { startsAt } : {}),
      ...(filters.providerId ? { providerId: filters.providerId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { customer: { is: { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { email: { contains: filters.search, mode: "insensitive" } }] } } } : {}),
    },
    skip: (filters.page - 1) * 20,
    take: 20,
  };
}
