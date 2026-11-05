import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import Link from "next/link";
import { StatusBadge } from "@/components/ui";

export default async function BookingConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([auth(), params]);
  if (!session?.user) notFound();
  const appointment = await prisma.appointment.findUnique({ where: { id }, select: { id: true, customerId: true, startsAt: true, endsAt: true, status: true, provider: { select: { user: { select: { name: true } } } }, service: { select: { name: true, price: true } } } });
  if (!appointment || (appointment.customerId !== session.user.id && session.user.role !== "ADMIN")) notFound();
  const timezone = getAvailabilityConfig().businessTimezone;
  const startsAt = DateTime.fromJSDate(appointment.startsAt, { zone: "utc" }).setZone(timezone);
  const endsAt = DateTime.fromJSDate(appointment.endsAt, { zone: "utc" }).setZone(timezone);
  return <main className="mx-auto max-w-2xl px-5 py-12 md:px-8">
    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800"><span aria-hidden="true">✓</span> Appointment confirmed</div>
    <h1 className="text-3xl font-bold">Booking details</h1>
    <section className="surface-card mt-6 p-6 sm:p-8"><dl className="divide-y divide-slate-100">{[{ label: "Service", value: appointment.service.name }, { label: "Provider", value: appointment.provider.user.name }, { label: "Date", value: startsAt.toFormat("cccc, LLLL d, yyyy") }, { label: "Time", value: `${startsAt.toFormat("h:mm a")}–${endsAt.toFormat("h:mm a")} (${timezone})` }, { label: "Price", value: `$${Number(appointment.service.price).toFixed(2)}` }].map((item) => <div key={item.label} className="flex justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">{item.label}</dt><dd className="text-right font-medium">{item.value}</dd></div>)}<div className="flex items-center justify-between gap-4 py-3 text-sm"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={appointment.status}/></dd></div></dl><Link href="/appointments" className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">View my appointments</Link></section>
  </main>;
}
