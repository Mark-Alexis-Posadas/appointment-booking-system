import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { auth } from "@/auth";
import { getAvailabilityConfig } from "@/lib/availability";
import { BookingError, rescheduleBooking } from "@/lib/booking";
import { executePrismaBooking } from "@/lib/prisma-booking";
import { getCancellationWindowHours } from "@/lib/appointment-status";
import { readJson } from "@/lib/admin-api";
import { rescheduleAppointmentSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "CUSTOMER") return NextResponse.json({ error: "Only customers can reschedule their appointments." }, { status: 403 });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = rescheduleAppointmentSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reschedule time.", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const { id } = await params;
    const appointment = await rescheduleBooking({ customerId: session.user.id, appointmentId: id, startsAt: parsed.data.startsAt }, executePrismaBooking, getAvailabilityConfig(), getCancellationWindowHours());
    return NextResponse.json({ appointment, businessTimezone: getAvailabilityConfig().businessTimezone });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2004" || error.code === "P2034" || error.code === "P2002")) return NextResponse.json({ error: "The selected time slot is no longer available. Please select another schedule." }, { status: 409 });
    console.error("Appointment reschedule failed", error);
    return NextResponse.json({ error: "Unable to reschedule appointment right now." }, { status: 500 });
  }
}
