import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";

const rangeSchema = z.object({ start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }) }).refine((value) => Date.parse(value.end) > Date.parse(value.start));

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "STAFF") return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const parsed = rangeSchema.safeParse({ start: params.get("start"), end: params.get("end") });
  if (!parsed.success) return NextResponse.json({ error: "A valid calendar date range is required." }, { status: 400 });

  const provider = await prisma.provider.findUnique({ where: { userId: session.user.id }, select: { id: true, isActive: true } });
  if (!provider || !provider.isActive) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  const [appointments, timeOff] = await Promise.all([
    prisma.appointment.findMany({ where: { providerId: provider.id, status: { in: ["BOOKED", "COMPLETED", "NO_SHOW"] }, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true, startsAt: true, endsAt: true, status: true, customer: { select: { name: true } }, service: { select: { name: true } } }, orderBy: { startsAt: "asc" } }),
    prisma.timeOff.findMany({ where: { providerId: provider.id, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true, startsAt: true, endsAt: true, reason: true }, orderBy: { startsAt: "asc" } }),
  ]);
  const events = [
    ...appointments.map((appointment) => ({ id: appointment.id, title: `${appointment.service.name} · ${appointment.customer.name}`, start: appointment.startsAt.toISOString(), end: appointment.endsAt.toISOString(), backgroundColor: appointment.status === "BOOKED" ? "#4f46e5" : appointment.status === "COMPLETED" ? "#15803d" : "#64748b", borderColor: appointment.status === "BOOKED" ? "#4338ca" : appointment.status === "COMPLETED" ? "#166534" : "#475569", extendedProps: { type: "appointment", customerName: appointment.customer.name, serviceName: appointment.service.name, status: appointment.status } })),
    ...timeOff.map((period) => ({ id: `timeoff-${period.id}`, title: period.reason || "Time off", start: period.startsAt.toISOString(), end: period.endsAt.toISOString(), display: "background", backgroundColor: "#e2e8f0", extendedProps: { type: "timeOff" } })),
  ];
  return NextResponse.json(events, { headers: { "X-Business-Timezone": getAvailabilityConfig().businessTimezone } });
}
