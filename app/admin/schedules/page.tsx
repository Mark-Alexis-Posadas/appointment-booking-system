import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminSchedulesPage() {
  const providers = await prisma.provider.findMany({ orderBy: { user: { name: "asc" } }, include: { user: { select: { name: true, email: true } }, workingHours: true } });
  return <main><h1 className="text-3xl font-bold">Schedules</h1><p className="mt-2 text-slate-600">Choose a provider to edit weekly hours and time off.</p>{providers.length === 0 ? <p className="mt-6 rounded border border-dashed p-6 text-slate-500">No providers to schedule yet.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{providers.map((provider) => <Link key={provider.id} href={`/admin/providers/${provider.id}/schedule`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300"><h2 className="font-semibold">{provider.user.name}</h2><p className="mt-1 text-sm text-slate-500">{provider.user.email}</p><p className="mt-3 text-sm text-slate-600">{provider.workingHours.length} weekly time range(s)</p><span className="mt-3 inline-block text-sm text-indigo-700 underline">Edit schedule</span></Link>)}</div>}</main>;
}
