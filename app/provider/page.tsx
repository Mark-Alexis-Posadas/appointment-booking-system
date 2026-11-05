import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { ProviderCalendar } from "@/components/provider-calendar";

export default async function ProviderDashboardPage() {
  const user = await requireRole("STAFF");
  const provider = await prisma.provider.findUnique({ where: { userId: user.id }, select: { id: true, isActive: true, user: { select: { name: true } } } });
  if (!provider || !provider.isActive) notFound();
  return <main className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14"><header className="page-heading"><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Staff workspace</p><h1 className="mt-2 text-3xl font-bold">Your schedule</h1><p className="mt-2 text-slate-600">Signed in as <span className="font-medium text-slate-800">{provider.user.name?.trim() || user.name?.trim() || "Staff member"}</span>. Review your appointments and time off. Calendar times use {getAvailabilityConfig().businessTimezone}.</p></header><ProviderCalendar timezone={getAvailabilityConfig().businessTimezone} /></main>;
}
