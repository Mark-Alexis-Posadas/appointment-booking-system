import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";
import { getAvailabilityConfig } from "@/lib/availability";
import { buildAdminAppointmentQuery } from "@/lib/admin-appointment-query";
import { DateTime } from "luxon";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  providerId: z.string().max(100).optional().or(z.literal("")),
  serviceId: z.string().max(100).optional().or(z.literal("")),
  status: z.enum(["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional().or(z.literal("")),
  search: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const config = getAvailabilityConfig();
  const { page, dateFrom, dateTo, providerId, serviceId, status, search } = parsed.data;
  if (dateFrom) {
    const start = DateTime.fromISO(dateFrom, { zone: config.businessTimezone });
    if (!start.isValid || start.toISODate() !== dateFrom) return NextResponse.json({ error: "Invalid start date." }, { status: 400 });
  }
  if (dateTo) {
    const end = DateTime.fromISO(dateTo, { zone: config.businessTimezone });
    if (!end.isValid || end.toISODate() !== dateTo) return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
  }
  if (dateFrom && dateTo && dateFrom > dateTo) return NextResponse.json({ error: "Start date must be on or before end date." }, { status: 400 });
  const query = buildAdminAppointmentQuery({ page, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}), ...(providerId ? { providerId } : {}), ...(serviceId ? { serviceId } : {}), ...(status ? { status } : {}), ...(search ? { search } : {}) }, config.businessTimezone);
  const [total, appointments] = await Promise.all([
    prisma.appointment.count({ where: query.where }),
    prisma.appointment.findMany({ where: query.where, orderBy: { startsAt: "desc" }, skip: query.skip, take: query.take, select: { id: true, startsAt: true, endsAt: true, status: true, customer: { select: { name: true, email: true } }, provider: { select: { user: { select: { name: true } } } }, service: { select: { name: true, price: true } } } }),
  ]);
  return NextResponse.json({ appointments, pagination: { page, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) }, businessTimezone: config.businessTimezone });
}
