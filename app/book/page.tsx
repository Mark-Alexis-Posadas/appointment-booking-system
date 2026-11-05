import { DateTime } from "luxon";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { BookingFlow } from "@/components/booking-flow";

export default async function BookPage({ searchParams }: { searchParams: Promise<{ serviceId?: string; providerId?: string; date?: string; startsAt?: string }> }) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const [services, providers] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true, durationMinutes: true, price: true }, orderBy: { name: "asc" } }),
    prisma.provider.findMany({ where: { isActive: true }, select: { id: true, user: { select: { name: true } }, services: { where: { isActive: true }, select: { id: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  const config = getAvailabilityConfig();
  const today = DateTime.now().setZone(config.businessTimezone).toISODate() ?? "";
  const maxDate = DateTime.now().setZone(config.businessTimezone).plus({ days: config.maxAdvanceDays }).toISODate() ?? "";
  return <main className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
    <header className="page-heading"><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Book online</p><h1 className="mt-2 text-3xl font-bold">Book an appointment</h1>
    <p className="mt-2 text-slate-600">Choose a service, provider, date, and time. Times are shown in {config.businessTimezone}.</p></header>
    <BookingFlow services={services.map((service) => ({ ...service, price: service.price.toString() }))} providers={providers.map((provider) => ({ id: provider.id, name: provider.user.name, serviceIds: provider.services.map((service) => service.id) }))} timezone={config.businessTimezone} minDate={today} maxDate={maxDate} authenticated={Boolean(session?.user)} initialSelection={params} />
  </main>;
}
