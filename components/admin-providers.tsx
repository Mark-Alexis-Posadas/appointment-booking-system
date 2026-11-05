"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button, PageHeader, StatusBadge } from "@/components/ui";

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
  const [confirmingProvider, setConfirmingProvider] = useState<Provider | null>(null);

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
    setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: nextActive }) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to deactivate provider.");
      setConfirmingProvider(null);
      setMessage(nextActive ? "Provider reactivated." : "Provider deactivated; appointment history was preserved."); setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to deactivate provider."); }
  }

  async function toggleProvider(provider: Provider) {
    if (!provider.isActive) {
      await deactivate(provider);
      return;
    }
    setConfirmingProvider(provider);
  }

  return <div>
    <PageHeader title="Providers" description="Manage staff profiles, services, and schedules." action={<Button onClick={() => { setEditing(null); setCreating(true); }}>New provider</Button>} />
    {(message || error) && <p role={error ? "alert" : "status"} className={`notice mt-4 ${error ? "notice-error" : "notice-success"}`}>{error ?? message}</p>}
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{loading ? <div className="surface-card p-6 text-slate-500">Loading providers…</div> : providers.length === 0 ? <div className="empty-state lg:col-span-2"><p className="font-semibold">No providers yet</p><p className="mt-2 text-sm">Add the first provider to begin managing availability.</p></div> : providers.map((provider) => <article key={provider.id} className="surface-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{provider.user.name}</h2><p className="text-sm text-slate-500">{provider.user.email}</p></div><div className="flex items-center gap-2"><StatusBadge status={provider.isActive ? "ACTIVE" : "INACTIVE"}/><span className="text-xs text-slate-500">{provider._count.appointments} appointments</span></div></div><p className="mt-3 text-sm text-slate-600">{provider.bio || "No bio yet."}</p><p className="mt-3 text-xs text-slate-500">Services: {provider.services.map((service) => service.name).join(", ") || "None assigned"}</p><div className="mt-4 flex flex-wrap gap-2 text-sm"><button onClick={() => setEditing(provider)} className="rounded-lg border border-slate-200 px-3 py-2 text-indigo-700 hover:bg-indigo-50">Edit</button>{provider.isActive && <Link className="rounded-lg border border-slate-200 px-3 py-2 text-indigo-700 hover:bg-indigo-50" href={`/admin/providers/${provider.id}/schedule`}>Schedule</Link>}<button onClick={() => void toggleProvider(provider)} className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50">{provider.isActive ? "Deactivate" : "Reactivate"}</button></div></article>)}</div>
    {(creating || editing) && <div role="dialog" aria-modal="true" aria-labelledby="provider-dialog-title" className="dialog-backdrop"><form key={editing?.id ?? "new"} onSubmit={submit} className="dialog-panel space-y-4"><h2 id="provider-dialog-title" className="text-xl font-bold">{editing ? "Edit provider" : "New provider"}</h2><label className="block text-sm">Name<input name="name" required minLength={2} placeholder="Provider name" defaultValue={editing?.user.name ?? ""} className="mt-1 w-full rounded-lg border p-2.5" /></label>{!editing && <><label className="block text-sm">Email<input name="email" type="email" required placeholder="provider@example.com" className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm">Temporary password<input name="temporaryPassword" type="password" minLength={8} required placeholder="At least 8 characters" className="mt-1 w-full rounded-lg border p-2.5" /></label></>}<label className="block text-sm">Bio<textarea name="bio" rows={3} placeholder="Add a short provider bio (optional)" defaultValue={editing?.bio ?? ""} className="mt-1 w-full rounded-lg border p-2.5" /></label><fieldset><legend className="text-sm font-medium">Services offered</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{services.map((service) => <label key={service.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-sm"><input type="checkbox" name="serviceIds" value={service.id} defaultChecked={editing?.services.some((item) => item.id === service.id) ?? false} />{service.name}</label>)}</div></fieldset><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save provider"}</Button></div></form></div>}
    {confirmingProvider && <div role="dialog" aria-modal="true" aria-labelledby="provider-confirm-title" className="dialog-backdrop"><section className="dialog-panel max-w-md"><h2 id="provider-confirm-title" className="text-lg font-bold">Deactivate provider?</h2><p className="mt-2 text-sm text-slate-600">{confirmingProvider.user.name} will no longer be available for new bookings. Appointment history will remain.</p>{error && <p role="alert" className="notice notice-error mt-4">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={() => setConfirmingProvider(null)}>Keep active</Button><Button variant="danger" disabled={busy} onClick={() => void deactivate(confirmingProvider)}>{busy ? "Saving…" : "Deactivate"}</Button></div></section></div>}
  </div>;
}
