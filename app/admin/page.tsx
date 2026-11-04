import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";

export default async function AdminDashboardPage() {
  const timezone = getAvailabilityConfig().businessTimezone;
  const now = DateTime.now().toUTC().toJSDate();
  const dayStart = DateTime.now().setZone(timezone).startOf("day").toUTC().toJSDate();
  const dayEnd = DateTime.now().setZone(timezone).plus({ days: 1 }).startOf("day").toUTC().toJSDate();
  const [services, providers, appointments, todayBookings, upcomingBookings] = await Promise.all([
    prisma.service.count(), prisma.provider.count(), prisma.appointment.count(),
    prisma.appointment.count({ where: { startsAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.appointment.count({ where: { status: "BOOKED", startsAt: { gte: now } } }),
  ]);
  return <main>
    <h1 className="text-3xl font-bold">Dashboard</h1>
    <p className="mt-2 text-slate-600">Overview of your clinic or salon setup.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[{ label: "Services", count: services, href: "/admin/services" }, { label: "Providers", count: providers, href: "/admin/providers" }, { label: "All appointments", count: appointments, href: "/admin/appointments" }, { label: "Today's bookings", count: todayBookings, href: "/admin/appointments" }, { label: "Upcoming bookings", count: upcomingBookings, href: "/admin/appointments?status=BOOKED" }].map((item) => <Link key={item.label} href={item.href} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.count}</p></Link>)}
    </div>
  </main>;
}
