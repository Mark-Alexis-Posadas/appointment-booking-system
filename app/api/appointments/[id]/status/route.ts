import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decideStatusUpdate, type AppointmentState } from "@/lib/appointment-status";
import { readJson } from "@/lib/admin-api";
import { appointmentStatusUpdateSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "STAFF" && session.user.role !== "ADMIN") return NextResponse.json({ error: "Provider or administrator access required." }, { status: 403 });
  const actorRole: "STAFF" | "ADMIN" = session.user.role === "STAFF" ? "STAFF" : "ADMIN";
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = appointmentStatusUpdateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid appointment status.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { id } = await params;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const provider = session.user.role === "STAFF" ? await tx.provider.findUnique({ where: { userId: session.user.id }, select: { id: true } }) : null;
      if (session.user.role === "STAFF" && !provider) return { kind: "not-found" as const };
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "id" = ${id} FOR UPDATE`);
      const appointment = await tx.appointment.findUnique({ where: { id }, select: { id: true, providerId: true, startsAt: true, status: true } });
      if (!appointment) return { kind: "not-found" as const };
      const decision = decideStatusUpdate({ current: appointment.status, next: parsed.data.status as AppointmentState, role: actorRole, ownsProvider: provider ? appointment.providerId === provider.id : true, startsAt: appointment.startsAt, now: new Date() });
      if (!decision.allowed) return { kind: "rejected" as const, decision };
      const result = await tx.appointment.update({ where: { id }, data: { status: parsed.data.status }, select: { id: true, status: true } });
      return { kind: "updated" as const, appointment: result };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (updated.kind === "not-found") return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    if (updated.kind === "rejected") return NextResponse.json({ error: updated.decision.message }, { status: updated.decision.status });
    return NextResponse.json({ appointment: updated.appointment });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Appointment changed while you were updating it. Refresh and try again." }, { status: 409 });
    console.error("Appointment status update failed", error);
    return NextResponse.json({ error: "Unable to update appointment right now." }, { status: 500 });
  }
}
