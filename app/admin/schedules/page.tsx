import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatusBadge } from "@/components/ui";

export default async function AdminSchedulesPage() {
  const providers = await prisma.provider.findMany({ orderBy: { user: { name: "asc" } }, include: { user: { select: { name: true, email: true } }, workingHours: true } });
  return <main><PageHeader title="Schedules" description="Choose a provider to edit weekly hours and time off." />{providers.length === 0 ? <div className="empty-state">No providers to schedule yet.</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{providers.map((provider) => <Link key={provider.id} href={`/admin/providers/${provider.id}/schedule`} className="surface-card p-5 transition hover:-translate-y-0.5 hover:border-indigo-200"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{provider.user.name}</h2><p className="mt-1 text-sm text-slate-500">{provider.user.email}</p></div><StatusBadge status={provider.isActive ? "ACTIVE" : "INACTIVE"}/></div><p className="mt-4 text-sm text-slate-600">{provider.workingHours.length} weekly time range(s)</p><span className="mt-4 inline-flex text-sm font-semibold text-indigo-700">Edit schedule <span className="ml-1" aria-hidden="true">→</span></span></Link>)}</div>}</main>;
}
