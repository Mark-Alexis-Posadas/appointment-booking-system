import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { auth } from "@/auth";
import { readJson } from "@/lib/admin-api";
import { getAvailabilityConfig } from "@/lib/availability";
import { BookingError, createBooking } from "@/lib/booking";
import { executePrismaBooking } from "@/lib/prisma-booking";
import { createAppointmentSchema } from "@/lib/schemas";
import { checkAvailabilityRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (session.user.role !== "CUSTOMER") return NextResponse.json({ error: "Only customer accounts can book appointments." }, { status: 403 });

  const rate = checkAvailabilityRateLimit(`booking:${session.user.id}`, Date.now(), 10, 60_000);
  const headers = { "X-RateLimit-Limit": "10", "X-RateLimit-Remaining": String(rate.remaining), "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)) };
  if (!rate.allowed) return NextResponse.json({ error: "Too many booking attempts. Try again shortly." }, { status: 429, headers });

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = createAppointmentSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking details.", details: parsed.error.flatten().fieldErrors }, { status: 400, headers });

  const config = getAvailabilityConfig();
  try {
    const appointment = await createBooking({ customerId: session.user.id, ...parsed.data }, executePrismaBooking, config);

    return NextResponse.json({ appointment, businessTimezone: config.businessTimezone }, { status: 201, headers });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const details = JSON.stringify(error.meta ?? {});
      if (error.code === "P2004" && (details.includes("23P01") || details.includes("Appointment_provider_no_booked_overlap"))) {
        return NextResponse.json({ error: "That slot is no longer available." }, { status: 409, headers });
      }
      if (error.code === "P2002" || error.code === "P2034") return NextResponse.json({ error: "That slot is no longer available. Please choose another time." }, { status: 409, headers });
    }
    console.error("Appointment booking failed", error);
    return NextResponse.json({ error: "Unable to complete booking right now." }, { status: 500, headers });
  }
}
