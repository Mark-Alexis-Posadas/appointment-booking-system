"use client";
import { useEffect, useState, type FormEvent } from "react";

type Service = { id: string; name: string; durationMinutes: number; price: string; isActive: boolean; _count: { appointments: number } };
type FormValue = { name: string; durationMinutes: number; price: number; isActive: boolean };

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/services").then(async (response) => {
      const result: { services?: Service[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load services.");
      if (active) setServices(result.services ?? []);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load services."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    const data = new FormData(event.currentTarget);
    const payload: FormValue = { name: String(data.get("name") ?? ""), durationMinutes: Number(data.get("durationMinutes")), price: Number(data.get("price")), isActive: data.get("isActive") === "on" };
    try {
      const response = await fetch("/api/admin/services", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save service.");
      setMessage(editing ? "Service updated." : "Service created."); setEditing(null); setCreating(false); setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save service."); }
    finally { setBusy(false); }
  }

  async function remove(service: Service) {
    if (!window.confirm(service._count.appointments ? "This service has appointments. Deactivate it instead?" : "Delete this service permanently?")) return;
    setError(null); setMessage(null);
    try {
      if (service._count.appointments) {
        const response = await fetch("/api/admin/services", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: service.id, name: service.name, durationMinutes: service.durationMinutes, price: Number(service.price), isActive: false }) });
        if (!response.ok) { const result: { error?: string } = await response.json(); throw new Error(result.error ?? "Unable to deactivate service."); }
        setMessage("Service deactivated.");
      } else {
        const response = await fetch("/api/admin/services", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: service.id }) });
        if (!response.ok) { const result: { error?: string } = await response.json(); throw new Error(result.error ?? "Unable to delete service."); }
        setMessage("Service deleted.");
      }
      setRefresh((value) => value + 1);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove service."); }
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold">Services</h1><p className="mt-1 text-slate-600">Manage the services customers can book.</p></div><button onClick={() => { setEditing(null); setCreating(true); }} className="rounded bg-indigo-700 px-4 py-2 text-white">New service</button></div>
    {(message || error) && <p role="status" className={`mt-4 rounded p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{error ?? message}</p>}
    <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{["Name", "Duration", "Price", "Status", "Actions"].map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={5} className="p-6 text-slate-500">Loading services…</td></tr> : services.length === 0 ? <tr><td colSpan={5} className="p-6 text-slate-500">No services yet. Add the first one above.</td></tr> : services.map((service) => <tr key={service.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{service.name}</td><td className="px-4 py-3">{service.durationMinutes} min</td><td className="px-4 py-3">${Number(service.price).toFixed(2)}</td><td className="px-4 py-3">{service.isActive ? "Active" : "Inactive"}</td><td className="space-x-3 px-4 py-3"><button onClick={() => setEditing(service)} className="text-indigo-700 underline">Edit</button><button onClick={() => void remove(service)} className="text-red-700 underline">{service._count.appointments ? "Deactivate" : "Delete"}</button></td></tr>)}</tbody></table>
    </div>
    {(editing || creating) && <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4"><form key={editing?.id ?? "new"} onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">{editing ? "Edit service" : "New service"}</h2><label className="block text-sm">Name<input name="name" required defaultValue={editing?.name ?? ""} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Duration (minutes)<input name="durationMinutes" type="number" min={5} max={480} required defaultValue={editing?.durationMinutes ?? 30} className="mt-1 w-full rounded border p-2" /></label><label className="block text-sm">Price<input name="price" type="number" min={0} step="0.01" required defaultValue={editing ? Number(editing.price) : 0} className="mt-1 w-full rounded border p-2" /></label><label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} />Active</label><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditing(null); setCreating(false); }} className="rounded border px-4 py-2">Cancel</button><button disabled={busy} className="rounded bg-indigo-700 px-4 py-2 text-white">{busy ? "Saving…" : "Save"}</button></div></form></div>}
  </div>;
}
