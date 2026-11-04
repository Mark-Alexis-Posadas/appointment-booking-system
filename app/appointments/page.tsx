import { DateTime } from "luxon";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { getCancellationWindowHours } from "@/lib/appointment-status";
import { CustomerAppointments } from "@/components/customer-appointments";

export default async function AppointmentsPage() {
  const user = await requireRole("CUSTOMER");
  const appointments = await prisma.appointment.findMany({ where: { customerId: user.id }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, status: true, providerId: true, serviceId: true, provider: { select: { user: { select: { name: true } } } }, service: { select: { name: true, price: true, durationMinutes: true } } } });
  const config = getAvailabilityConfig();
  const businessNow = DateTime.now().setZone(config.businessTimezone);
  const today = businessNow.toISODate() ?? "";
  const maxDate = businessNow.plus({ days: config.maxAdvanceDays }).toISODate() ?? "";
  return <main className="mx-auto max-w-5xl px-5 py-10 md:px-8"><h1 className="text-3xl font-bold">My appointments</h1><p className="mt-2 text-slate-600">Manage your bookings. Times are shown in {config.businessTimezone}.</p><CustomerAppointments appointments={appointments.map((appointment) => ({ ...appointment, startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt.toISOString(), price: appointment.service.price.toString() }))} timezone={config.businessTimezone} cancellationWindowHours={getCancellationWindowHours()} minDate={today} maxDate={maxDate} /></main>;
}
