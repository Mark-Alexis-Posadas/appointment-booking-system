"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, PageHeader, StatusBadge } from "@/components/ui";

type Service = { id: string; name: string; durationMinutes: number; price: string; isActive: boolean; _count: { appointments: number } };
type FormValue = { name: string; durationMinutes: number; price: number; isActive: boolean };

export function AdminServices() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<Service | null>(null);
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
      setRemoveTarget(null);
      setRefresh((value) => value + 1);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove service."); }
  }

  return <div>
    <PageHeader title="Services" description="Manage the services customers can book." action={<Button onClick={() => { setEditing(null); setCreating(true); }}>New service</Button>} />
    {(error || message) && !removeTarget && <p role={error ? "alert" : "status"} className={`notice mt-4 ${error ? "notice-error" : "notice-success"}`}>{error ?? message}</p>}
    <div className="table-wrap mt-6">
      <table className="w-full min-w-[640px] text-left text-sm"><thead><tr>{["Name", "Duration", "Price", "Status", "Actions"].map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>
        {loading ? <tr><td colSpan={5} className="p-6 text-slate-500">Loading services…</td></tr> : services.length === 0 ? <tr><td colSpan={5} className="p-6 text-slate-500">No services yet. Add the first one above.</td></tr> : services.map((service) => <tr key={service.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{service.name}</td><td className="px-4 py-3">{service.durationMinutes} min</td><td className="px-4 py-3">${Number(service.price).toFixed(2)}</td><td className="px-4 py-3"><StatusBadge status={service.isActive ? "ACTIVE" : "INACTIVE"}/></td><td className="space-x-2 px-4 py-3"><button onClick={() => setEditing(service)} className="rounded-md px-2 py-1 text-indigo-700 hover:bg-indigo-50">Edit</button><button onClick={() => setRemoveTarget(service)} className="rounded-md px-2 py-1 text-red-700 hover:bg-red-50">{service._count.appointments ? "Deactivate" : "Delete"}</button></td></tr>)}</tbody></table>
    </div>
    {(editing || creating) && <div role="dialog" aria-modal="true" aria-labelledby="service-dialog-title" className="dialog-backdrop"><form key={editing?.id ?? "new"} onSubmit={submit} className="dialog-panel space-y-4"><h2 id="service-dialog-title" className="text-xl font-bold">{editing ? "Edit service" : "New service"}</h2><label className="block text-sm">Name<input name="name" required defaultValue={editing?.name ?? ""} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm">Duration (minutes)<input name="durationMinutes" type="number" min={5} max={480} required defaultValue={editing?.durationMinutes ?? 30} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm">Price<input name="price" type="number" min={0} step="0.01" required defaultValue={editing ? Number(editing.price) : 0} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} />Active</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save service"}</Button></div></form></div>}
    {removeTarget && <div role="dialog" aria-modal="true" aria-labelledby="remove-service-title" className="dialog-backdrop"><section className="dialog-panel max-w-md"><h2 id="remove-service-title" className="text-lg font-bold">{removeTarget._count.appointments ? "Deactivate service?" : "Delete service?"}</h2><p className="mt-2 text-sm text-slate-600">{removeTarget._count.appointments ? "This service has appointment history. It will be deactivated and hidden from new bookings." : "This service will be permanently deleted."}</p>{error && <p role="alert" className="notice notice-error mt-4">{error}</p>}<div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={busy} onClick={() => setRemoveTarget(null)}>Keep service</Button><Button variant="danger" disabled={busy} onClick={() => void remove(removeTarget)}>{busy ? "Removing…" : removeTarget._count.appointments ? "Deactivate" : "Delete service"}</Button></div></section></div>}
  </div>;
}
