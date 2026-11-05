import Link from "next/link";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function AdminDashboardPage() {
  const config = getAvailabilityConfig();
  const now = DateTime.now().setZone(config.businessTimezone);
  const todayStart = now.startOf("day").toUTC().toJSDate();
  const tomorrow = now.plus({ days: 1 }).startOf("day").toUTC().toJSDate();
  const current = now.toUTC().toJSDate();
  const [activeServices, activeProviders, allAppointments, upcomingAppointments, todayAppointments, completedAppointments, cancelledAppointments, recentAppointments] = await Promise.all([
    prisma.service.count({ where: { isActive: true } }),
    prisma.provider.count({ where: { isActive: true } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: "BOOKED", startsAt: { gte: current } } }),
    prisma.appointment.count({ where: { startsAt: { gte: todayStart, lt: tomorrow } } }),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    prisma.appointment.count({ where: { status: "CANCELLED" } }),
    prisma.appointment.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, startsAt: true, status: true, customer: { select: { name: true } }, provider: { select: { user: { select: { name: true } } } }, service: { select: { name: true } } } }),
  ]);
  const metrics = [
    { label: "Appointments", value: allAppointments, note: "All time" },
    { label: "Upcoming", value: upcomingAppointments, note: "Currently booked" },
    { label: "Today", value: todayAppointments, note: now.toFormat("cccc, LLL d") },
    { label: "Completed", value: completedAppointments, note: "All time" },
    { label: "Active providers", value: activeProviders, note: "Available staff" },
    { label: "Active services", value: activeServices, note: "Available to customers" },
  ];
  return (
    <>
      <PageHeader title="Overview" description={`A snapshot of your appointments and team · ${config.businessTimezone}`} />
      <section aria-label="Appointment and team metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric, index) => <article key={metric.label} className="surface-card kpi-card"><div className="flex items-center justify-between"><p className="kpi-label">{metric.label}</p><span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${index % 2 === 0 ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span></div><p className="kpi-value">{metric.value.toLocaleString()}</p><p className="mt-2 text-xs text-slate-500">{metric.note}</p></article>)}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="section-title">Recent activity</h2><p className="mt-1 text-sm text-slate-500">Latest appointments created</p></div><Link href="/admin/appointments" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">View all →</Link></div>
          {recentAppointments.length === 0 ? <div className="empty-state"><p className="font-semibold text-slate-700">No appointments yet</p><p className="mt-2 text-sm">Bookings will appear here when customers schedule a visit.</p></div> : <div className="table-wrap"><table className="min-w-[680px] text-left text-sm"><thead><tr><th>Customer</th><th>Service & provider</th><th>Appointment time</th><th>Status</th></tr></thead><tbody>{recentAppointments.map((appointment) => <tr key={appointment.id}><td className="font-semibold text-slate-800">{appointment.customer.name}</td><td><p className="font-medium text-slate-700">{appointment.service.name}</p><p className="mt-1 text-xs text-slate-500">{appointment.provider.user.name}</p></td><td className="text-slate-600">{DateTime.fromJSDate(appointment.startsAt, { zone: "utc" }).setZone(config.businessTimezone).toFormat("LLL d · h:mm a")}</td><td><StatusBadge status={appointment.status}/></td></tr>)}</tbody></table></div>}
        </div>
        <aside className="surface-card h-fit p-5"><h2 className="section-title">Quick actions</h2><p className="mt-1 text-sm text-slate-500">Manage the parts of your workspace.</p><div className="mt-4 space-y-2">{[{ label: "Review appointments", href: "/admin/appointments" }, { label: "Manage providers", href: "/admin/providers" }, { label: "Update services", href: "/admin/services" }, { label: "Edit schedules", href: "/admin/schedules" }].map((item) => <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-3 text-sm font-medium text-slate-700 hover:border-indigo-100 hover:bg-indigo-50/50">{item.label}<span className="text-slate-400" aria-hidden="true">→</span></Link>)}</div><div className="mt-5 rounded-lg bg-slate-50 p-3.5"><p className="text-xs font-semibold text-slate-700">Appointment outcomes</p><div className="mt-3 flex items-center justify-between text-xs text-slate-600"><span>Completed</span><span className="font-semibold">{completedAppointments}</span></div><div className="mt-2 flex items-center justify-between text-xs text-slate-600"><span>Cancelled</span><span className="font-semibold">{cancelledAppointments}</span></div></div></aside>
      </section>
    </>
  );
}
