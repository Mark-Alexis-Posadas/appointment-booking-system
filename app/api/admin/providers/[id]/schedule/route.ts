import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { scheduleSchema, timeOffSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const provider = await prisma.provider.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } }, workingHours: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }, timeOff: { orderBy: { startsAt: "asc" } } } });
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  return NextResponse.json({ provider, businessTimezone: process.env.BUSINESS_TIMEZONE || "Asia/Manila" });
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = scheduleSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid working hours.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (!(await prisma.provider.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { providerId: id } });
    const entries = parsed.data.days.flatMap((day) => day.ranges.map((range) => ({ providerId: id, weekday: day.weekday, startTime: range.startTime, endTime: range.endTime })));
    if (entries.length) await tx.workingHours.createMany({ data: entries });
  });
  return NextResponse.json({ success: true });
}

export async function POST(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = timeOffSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid time-off period.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (!(await prisma.provider.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const overlaps = await prisma.appointment.findMany({ where: { providerId: id, status: "BOOKED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, select: { id: true, startsAt: true, endsAt: true }, orderBy: { startsAt: "asc" } });
  const timeOff = await prisma.timeOff.create({ data: { providerId: id, startsAt, endsAt, reason: parsed.data.reason || null } });
  return NextResponse.json({ timeOff, warning: overlaps.length ? `This time off overlaps ${overlaps.length} booked appointment(s).` : null, overlappingAppointments: overlaps }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  const timeOffId = typeof input.id === "string" ? input.id : "";
  if (!timeOffId) return NextResponse.json({ error: "Time-off id is required." }, { status: 400 });
  try {
    await prisma.timeOff.delete({ where: { id: timeOffId, providerId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Time-off period not found." }, { status: 404 });
    throw error;
  }
}
