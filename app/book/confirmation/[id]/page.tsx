import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params]);
  if (!session?.user) notFound();
  const appointment = await prisma.appointment.findUnique({ where: { id }, select: { id: true, customerId: true, startsAt: true, endsAt: true, status: true, provider: { select: { user: { select: { name: true } } } }, service: { select: { name: true, price: true } } } });
  if (!appointment || (appointment.customerId !== session.user.id && session.user.role !== "ADMIN")) notFound();
  const timezone = getAvailabilityConfig().businessTimezone;
  const startsAt = DateTime.fromJSDate(appointment.startsAt, { zone: "utc" }).setZone(timezone);
  const endsAt = DateTime.fromJSDate(appointment.endsAt, { zone: "utc" }).setZone(timezone);
  return <main className="mx-auto max-w-2xl px-5 py-12 md:px-8">
    <p className="text-sm font-semibold text-green-700">Appointment confirmed</p>
    <h1 className="mt-2 text-3xl font-bold">Booking details</h1>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><dl className="space-y-4"><div className="flex justify-between gap-4"><dt className="text-slate-500">Service</dt><dd className="font-medium">{appointment.service.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Provider</dt><dd className="font-medium">{appointment.provider.user.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Date</dt><dd>{startsAt.toFormat("cccc, LLLL d, yyyy")}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Time</dt><dd>{startsAt.toFormat("h:mm a")}–{endsAt.toFormat("h:mm a")} ({timezone})</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Price</dt><dd>${Number(appointment.service.price).toFixed(2)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd>{appointment.status}</dd></div></dl></section>
  </main>;
}
