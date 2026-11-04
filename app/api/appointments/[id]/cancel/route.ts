import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decideCancellation, getCancellationWindowHours } from "@/lib/appointment-status";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "CUSTOMER" && session.user.role !== "ADMIN") return NextResponse.json({ error: "You cannot cancel appointments." }, { status: 403 });
  const { id } = await params;

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Appointment" WHERE "id" = ${id} FOR UPDATE`);
      const current = await tx.appointment.findUnique({ where: { id }, select: { id: true, customerId: true, startsAt: true, status: true } });
      if (!current) return { kind: "not-found" as const };
      const decision = decideCancellation({ role: session.user.role, ownerMatches: current.customerId === session.user.id, status: current.status, startsAt: current.startsAt, now: new Date(), cancellationWindowHours: getCancellationWindowHours() });
      if (!decision.allowed) return { kind: "rejected" as const, decision };
      const updated = await tx.appointment.update({ where: { id }, data: { status: "CANCELLED" }, select: { id: true, status: true } });
      return { kind: "cancelled" as const, appointment: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (appointment.kind === "not-found") return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    if (appointment.kind === "rejected") return NextResponse.json({ error: appointment.decision.message }, { status: appointment.decision.status });
    return NextResponse.json({ appointment: appointment.appointment });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Appointment changed while cancelling. Refresh and try again." }, { status: 409 });
    console.error("Appointment cancellation failed", error);
    return NextResponse.json({ error: "Unable to cancel appointment right now." }, { status: 500 });
  }
}
