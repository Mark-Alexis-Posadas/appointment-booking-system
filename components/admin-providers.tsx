"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Service = { id: string; name: string };
type Provider = { id: string; bio: string | null; isActive: boolean; user: { name: string; email: string }; services: Service[]; _count: { appointments: number } };

export function AdminProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/admin/providers"), fetch("/api/admin/services")]).then(async ([providerResponse, serviceResponse]) => {
      const providerResult: { providers?: Provider[]; error?: string } = await providerResponse.json();
      const serviceResult: { services?: Service[]; error?: string } = await serviceResponse.json();
      if (!providerResponse.ok || !serviceResponse.ok) throw new Error(providerResult.error ?? serviceResult.error ?? "Unable to load admin data.");
      if (active) { setProviders(providerResult.providers ?? []); setServices(serviceResult.services ?? []); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load providers."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    const serviceIds = data.getAll("serviceIds").map(String);
    const payload = { name: String(data.get("name") ?? ""), email: String(data.get("email") ?? ""), temporaryPassword: String(data.get("temporaryPassword") ?? ""), bio: String(data.get("bio") ?? ""), serviceIds };
    try {
      const response = await fetch(editing ? `/api/admin/providers/${editing.id}` : "/api/admin/providers", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { name: payload.name, bio: payload.bio, serviceIds } : payload) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save provider.");
      setMessage(editing ? "Provider updated." : "Provider created."); setEditing(null); setCreating(false); setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save provider."); }
    finally { setBusy(false); }
  }

  async function deactivate(provider: Provider) {
    const nextActive = !provider.isActive;
    if (!window.confirm(`${nextActive ? "Reactivate" : "Deactivate"} ${provider.user.name}?`)) return;
    setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: nextActive }) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to deactivate provider.");
      setMessage(nextActive ? "Provider reactivated." : "Provider deactivated; appointment history was preserved."); setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to deactivate provider."); }
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Providers</h1><p className="mt-1 text-slate-600">Manage staff profiles, services, and schedules.</p></div><button onClick={() => { setEditing(null); setCreating(true); }} className="rounded bg-indigo-700 px-4 py-2 text-white">New provider</button></div>
    {(message || error) && <p role="status" className={`mt-4 rounded p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{error ?? message}</p>}
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{loading ? <p className="text-slate-500">Loading providers…</p> : providers.length === 0 ? <p className="rounded border border-dashed p-6 text-slate-500">No providers yet. Add the first provider above.</p> : providers.map((provider) => <article key={provider.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{provider.user.name}</h2><p className="text-sm text-slate-500">{provider.user.email}</p></div><span className={`text-xs ${provider.isActive ? "text-green-700" : "text-slate-500"}`}>{provider.isActive ? "Active" : "Inactive"} · {provider._count.appointments} appointments</span></div><p className="mt-3 text-sm text-slate-600">{provider.bio || "No bio yet."}</p><p className="mt-3 text-xs text-slate-500">Services: {provider.services.map((service) => service.name).join(", ") || "None assigned"}</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><button onClick={() => setEditing(provider)} className="text-indigo-700 underline">Edit</button>{provider.isActive && <Link className="text-indigo-700 underline" href={`/admin/providers/${provider.id}/schedule`}>Schedule</Link>}<button onClick={() => void deactivate(provider)} className="text-red-700 underline">{provider.isActive ? "Deactivate" : "Reactivate"}</button></div></article>)}</div>
    {(creating || editing) && <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"><form key={editing?.id ?? "new"} onSubmit={submit} className="my-8 w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">{editing ? "Edit provider" : "New provider"}</h2><label className="block text-sm">Name<input name="name" required minLength={2} defaultValue={editing?.user.name ?? ""} className="mt-1 w-full rounded border p-2" /></label>{!editing && <><label className="block text-sm">Email<input name="email" type="email" required className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Temporary password<input name="temporaryPassword" type="password" minLength={8} required className="mt-1 w-full rounded border p-2" /></label></>}<label className="block text-sm">Bio<textarea name="bio" rows={3} defaultValue={editing?.bio ?? ""} className="mt-1 w-full rounded border p-2" /></label><fieldset><legend className="text-sm font-medium">Services offered</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="serviceIds" value={service.id} defaultChecked={editing?.services.some((item) => item.id === service.id) ?? false} />{service.name}</label>)}</div></fieldset><div className="flex justify-end gap-2"><button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="rounded border px-4 py-2">Cancel</button><button disabled={busy} className="rounded bg-indigo-700 px-4 py-2 text-white">{busy ? "Saving…" : "Save"}</button></div></form></div>}
  </div>;
}
