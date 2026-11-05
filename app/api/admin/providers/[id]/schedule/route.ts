import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { scheduleSchema, timeOffSchema } from "@/lib/schemas";
import { findAppointmentsOutsideSchedule } from "@/lib/availability";
import { lockProviderRows } from "@/lib/prisma-booking";

function acquireProviderLock(tx: Prisma.TransactionClient, providerId: string) {
  return lockProviderRows(tx, [providerId]);
}

function conflictResponse(
  error: string,
  appointments: Array<{ id: string; startsAt: Date; endsAt: Date }>,
) {
  return NextResponse.json(
    {
      error,
      affectedAppointments: appointments.map(({ id, startsAt, endsAt }) => ({
        id,
        startsAt,
        endsAt,
      })),
    },
    { status: 409 },
  );
}

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await params;
  const provider = await prisma.provider.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      workingHours: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      timeOff: { orderBy: { startsAt: "asc" } },
    },
  });
  if (!provider)
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  return NextResponse.json({
    provider,
    businessTimezone: process.env.BUSINESS_TIMEZONE || "Asia/Manila",
  });
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = scheduleSchema.safeParse(body.data);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Invalid working hours.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const locked = await acquireProviderLock(tx, id);
        if (!locked.length) return { kind: "not-found" as const };
        const appointments = await tx.appointment.findMany({
          where: { providerId: id, status: "BOOKED" },
          select: { id: true, startsAt: true, endsAt: true },
        });
        const timezone = process.env.BUSINESS_TIMEZONE || "Asia/Manila";
        const affected = findAppointmentsOutsideSchedule(
          appointments,
          parsed.data.days,
          timezone,
        );
        if (affected.length)
          return { kind: "conflict" as const, appointments: affected };
        await tx.workingHours.deleteMany({ where: { providerId: id } });
        const entries = parsed.data.days.flatMap((day) =>
          day.ranges.map((range) => ({
            providerId: id,
            weekday: day.weekday,
            startTime: range.startTime,
            endTime: range.endTime,
          })),
        );
        if (entries.length) await tx.workingHours.createMany({ data: entries });
        return { kind: "updated" as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return NextResponse.json(
        {
          error:
            "The schedule changed at the same time. Refresh and try again.",
        },
        { status: 409 },
      );
    throw error;
  }
  if (result.kind === "not-found")
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (result.kind === "conflict")
    return conflictResponse(
      "This schedule cannot be updated because existing appointments would be affected.",
      result.appointments,
    );
  return NextResponse.json({ success: true });
}

export async function POST(request: Request, { params }: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = timeOffSchema.safeParse(body.data);
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Invalid time-off period.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const locked = await acquireProviderLock(tx, id);
        if (!locked.length) return { kind: "not-found" as const };
        const overlaps = await tx.appointment.findMany({
          where: {
            providerId: id,
            status: "BOOKED",
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true, startsAt: true, endsAt: true },
          orderBy: { startsAt: "asc" },
        });
        if (overlaps.length)
          return { kind: "conflict" as const, appointments: overlaps };
        const timeOff = await tx.timeOff.create({
          data: {
            providerId: id,
            startsAt,
            endsAt,
            reason: parsed.data.reason || null,
          },
        });
        return { kind: "created" as const, timeOff };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return NextResponse.json(
        {
          error:
            "The schedule changed at the same time. Refresh and try again.",
        },
        { status: 409 },
      );
    throw error;
  }
  if (result.kind === "not-found")
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (result.kind === "conflict")
    return conflictResponse(
      "This time-off period conflicts with existing booked appointments.",
      result.appointments,
    );
  return NextResponse.json(
    { timeOff: result.timeOff, warning: null, overlappingAppointments: [] },
    { status: 201 },
  );
}

export async function DELETE(request: Request, { params }: Context) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  const timeOffId = typeof input.id === "string" ? input.id : "";
  if (!timeOffId)
    return NextResponse.json(
      { error: "Time-off id is required." },
      { status: 400 },
    );
  try {
    const deleted = await prisma.$transaction(
      async (tx) => {
        const locked = await acquireProviderLock(tx, id);
        if (!locked.length) return false;
        await tx.timeOff.delete({ where: { id: timeOffId, providerId: id } });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!deleted)
      return NextResponse.json(
        { error: "Provider not found." },
        { status: 404 },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      return NextResponse.json(
        { error: "Time-off period not found." },
        { status: 404 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return NextResponse.json(
        {
          error:
            "The schedule changed at the same time. Refresh and try again.",
        },
        { status: 409 },
      );
    throw error;
  }
}
