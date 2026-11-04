"use client";
import { useMemo, useState } from "react";
import { DateTime } from "luxon";
import { DateSlotPicker } from "@/components/date-slot-picker";

type Appointment = { id: string; startsAt: string; endsAt: string; status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"; providerId: string; serviceId: string; provider: { user: { name: string } }; service: { name: string; durationMinutes: number }; price: string };

export function CustomerAppointments({ appointments, timezone, cancellationWindowHours, minDate, maxDate }: { appointments: Appointment[]; timezone: string; cancellationWindowHours: number; minDate: string; maxDate: string }) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const upcoming = useMemo(() => appointments.filter((item) => item.status === "BOOKED" && new Date(item.startsAt).getTime() >= now), [appointments, now]);
  const past = useMemo(() => appointments.filter((item) => !upcoming.includes(item)), [appointments, upcoming]);
  const shown = tab === "upcoming" ? upcoming : past;

  function displayTime(value: string) { return new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  async function cancel(appointment: Appointment) {
    if (!window.confirm("Cancel this appointment? This action cannot be undone.")) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}/cancel`, { method: "PATCH" });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to cancel appointment.");
      setNotice("Appointment cancelled."); window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel appointment."); }
    finally { setBusy(false); }
  }
  async function saveReschedule() {
    if (!rescheduling || !newStart) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(rescheduling.id)}/reschedule`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: newStart }) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to reschedule appointment.");
      setNotice("Appointment rescheduled."); setRescheduling(null); window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reschedule appointment."); }
    finally { setBusy(false); }
  }

  return <div className="mt-7">
    <div className="flex gap-2 border-b border-slate-200" role="tablist"><button role="tab" aria-selected={tab === "upcoming"} onClick={() => setTab("upcoming")} className={`px-4 py-3 text-sm font-medium ${tab === "upcoming" ? "border-b-2 border-indigo-700 text-indigo-800" : "text-slate-500"}`}>Upcoming ({upcoming.length})</button><button role="tab" aria-selected={tab === "past"} onClick={() => setTab("past")} className={`px-4 py-3 text-sm font-medium ${tab === "past" ? "border-b-2 border-indigo-700 text-indigo-800" : "text-slate-500"}`}>Past/Cancelled ({past.length})</button></div>
    {(notice || error) && <p role="status" className={`mt-4 rounded p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{error ?? notice}</p>}
    {shown.length === 0 ? <p className="mt-6 rounded border border-dashed p-8 text-center text-slate-500">{tab === "upcoming" ? "You have no upcoming appointments." : "No past or cancelled appointments."}</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{shown.map((appointment) => {
      const canManage = appointment.status === "BOOKED" && new Date(appointment.startsAt).getTime() - now > cancellationWindowHours * 3_600_000;
      return <article key={appointment.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{appointment.service.name}</h2><p className="mt-1 text-sm text-slate-600">with {appointment.provider.user.name}</p></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${appointment.status === "BOOKED" ? "bg-indigo-50 text-indigo-800" : appointment.status === "COMPLETED" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{appointment.status.replace("_", " ")}</span></div><p className="mt-4 text-sm">{displayTime(appointment.startsAt)}</p><p className="mt-1 text-sm text-slate-500">{appointment.service.durationMinutes} min · ${Number(appointment.price).toFixed(2)} · {timezone}</p>{canManage && <div className="mt-4 flex gap-4 text-sm"><button onClick={() => { setRescheduling(appointment); setNewDate(DateTime.fromISO(appointment.startsAt, { zone: "utc" }).setZone(timezone).toISODate() ?? minDate); setNewStart(""); setError(null); }} className="text-indigo-700 underline">Reschedule</button><button disabled={busy} onClick={() => void cancel(appointment)} className="text-red-700 underline disabled:opacity-50">Cancel</button></div>}</article>;
    })}</div>}
    {rescheduling && <div role="dialog" aria-modal="true" className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4"><section className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">Reschedule {rescheduling.service.name}</h2><p className="mt-1 text-sm text-slate-600">The provider and service stay the same. Current time: {displayTime(rescheduling.startsAt)}.</p><div className="mt-5"><DateSlotPicker providerId={rescheduling.providerId} serviceId={rescheduling.serviceId} timezone={timezone} minDate={minDate} maxDate={maxDate} date={newDate} selectedStartsAt={newStart} onDateChange={(value) => { setNewDate(value); setNewStart(""); }} onSelect={(slot) => setNewStart(slot.startsAt)} /></div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setRescheduling(null)} className="rounded border px-4 py-2">Keep current time</button><button type="button" disabled={!newStart || busy} onClick={() => void saveReschedule()} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm new time"}</button></div></section></div>}
  </div>;
}
