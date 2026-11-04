import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { ProviderCalendar } from "@/components/provider-calendar";

export default async function ProviderDashboardPage() {
  const user = await requireRole("STAFF");
  const provider = await prisma.provider.findUnique({ where: { userId: user.id }, select: { id: true, isActive: true } });
  if (!provider || !provider.isActive) notFound();
  return <main className="mx-auto max-w-7xl px-4 py-8 md:px-8"><h1 className="text-3xl font-bold">Provider dashboard</h1><p className="mt-2 text-slate-600">Your appointments and time off. Calendar times use {getAvailabilityConfig().businessTimezone}.</p><ProviderCalendar timezone={getAvailabilityConfig().businessTimezone} /></main>;
}
