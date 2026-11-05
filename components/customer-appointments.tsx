"use client";
import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { DateSlotPicker } from "@/components/date-slot-picker";
import { StatusBadge } from "@/components/ui";

type Appointment = { id: string; startsAt: string; endsAt: string; status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"; providerId: string; serviceId: string; provider: { user: { name: string } }; service: { name: string; durationMinutes: number }; price: string };

export function CustomerAppointments({ appointments, timezone, cancellationWindowHours, minDate, maxDate }: { appointments: Appointment[]; timezone: string; cancellationWindowHours: number; minDate: string; maxDate: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  useEffect(() => {
    if (!rescheduling && !cancelTarget) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setRescheduling(null);
        setCancelTarget(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rescheduling, cancelTarget, busy]);
  const now = Date.now();
  const upcoming = useMemo(() => appointments.filter((item) => item.status === "BOOKED" && new Date(item.startsAt).getTime() >= now), [appointments, now]);
  const past = useMemo(() => appointments.filter((item) => !upcoming.includes(item)), [appointments, upcoming]);
  const shown = tab === "upcoming" ? upcoming : past;

  function displayTime(value: string) { return new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  function cancel(appointment: Appointment) {
    setCancelTarget(appointment);
  }
  async function confirmCancel() {
    if (!cancelTarget) return;
    const appointment = cancelTarget;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}/cancel`, { method: "PATCH" });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to cancel appointment.");
      setNotice("Appointment cancelled."); setCancelTarget(null); router.refresh();
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
      setNotice("Appointment rescheduled."); setRescheduling(null); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to reschedule appointment."); }
    finally { setBusy(false); }
  }

  return <div className="mt-7">
    <div className="flex gap-2 border-b border-slate-200" role="tablist" aria-label="Appointment history"><button id="upcoming-tab" role="tab" aria-controls="appointment-panel" aria-selected={tab === "upcoming"} tabIndex={tab === "upcoming" ? 0 : -1} onClick={() => setTab("upcoming")} className={`px-4 py-3 text-sm font-medium ${tab === "upcoming" ? "border-b-2 border-indigo-700 text-indigo-800" : "text-slate-500"}`}>Upcoming ({upcoming.length})</button><button id="past-tab" role="tab" aria-controls="appointment-panel" aria-selected={tab === "past"} tabIndex={tab === "past" ? 0 : -1} onClick={() => setTab("past")} className={`px-4 py-3 text-sm font-medium ${tab === "past" ? "border-b-2 border-indigo-700 text-indigo-800" : "text-slate-500"}`}>Past/Cancelled ({past.length})</button></div>
    {(notice || error) && !cancelTarget && <p role={error ? "alert" : "status"} className={`notice mt-4 ${error ? "notice-error" : "notice-success"}`}>{error ?? notice}</p>}
    <section id="appointment-panel" role="tabpanel" aria-labelledby={tab === "upcoming" ? "upcoming-tab" : "past-tab"} tabIndex={0} className="outline-none">{shown.length === 0 ? <p className="empty-state mt-6">{tab === "upcoming" ? "You have no upcoming appointments." : "No past or cancelled appointments."}</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{shown.map((appointment) => {
      const canManage = appointment.status === "BOOKED" && new Date(appointment.startsAt).getTime() - now > cancellationWindowHours * 3_600_000;
      return <article key={appointment.id} className="surface-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{appointment.service.name}</h2><p className="mt-1 text-sm text-slate-600">with {appointment.provider.user.name}</p></div><StatusBadge status={appointment.status}/></div><p className="mt-4 text-sm font-medium">{displayTime(appointment.startsAt)}</p><p className="mt-1 text-sm text-slate-500">{appointment.service.durationMinutes} min · ${Number(appointment.price).toFixed(2)} · {timezone}</p>{canManage && <div className="mt-5 flex flex-wrap gap-3 text-sm"><button onClick={() => { setRescheduling(appointment); setNewDate(DateTime.fromISO(appointment.startsAt, { zone: "utc" }).setZone(timezone).toISODate() ?? minDate); setNewStart(""); setError(null); }} className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-50">Reschedule</button><button disabled={busy} onClick={() => void cancel(appointment)} className="rounded-lg border border-red-200 px-3 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Cancel</button></div>}</article>;
    })}</div>}</section>
    {rescheduling && <div role="dialog" aria-modal="true" aria-labelledby="reschedule-title" className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setRescheduling(null); }}><section className="dialog-panel"><h2 id="reschedule-title" className="text-xl font-bold">Reschedule {rescheduling.service.name}</h2><p className="mt-1 text-sm text-slate-600">The provider and service stay the same. Current time: {displayTime(rescheduling.startsAt)}.</p><div className="mt-5"><DateSlotPicker providerId={rescheduling.providerId} serviceId={rescheduling.serviceId} timezone={timezone} minDate={minDate} maxDate={maxDate} date={newDate} selectedStartsAt={newStart} onDateChange={(value) => { setNewDate(value); setNewStart(""); }} onSelect={(slot) => setNewStart(slot.startsAt)} /></div>{error && <p role="alert" className="notice notice-error mt-4">{error}</p>}<div className="mt-5 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" onClick={() => setRescheduling(null)} className="rounded-lg border border-slate-200 px-4 py-2">Keep current time</button><button type="button" disabled={!newStart || busy} onClick={() => void saveReschedule()} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Confirm new time"}</button></div></section></div>}
    {cancelTarget && <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCancelTarget(null); }}><section className="dialog-panel max-w-md"><h2 id="cancel-title" className="text-lg font-bold">Cancel appointment?</h2><p className="mt-2 text-sm text-slate-600">Cancel your {cancelTarget.service.name} appointment with {cancelTarget.provider.user.name} on {displayTime(cancelTarget.startsAt)}?</p>{error && <p role="alert" className="notice notice-error mt-4">{error}</p>}<div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" disabled={busy} onClick={() => setCancelTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2">Keep appointment</button><button type="button" disabled={busy} onClick={() => void confirmCancel()} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Cancelling…" : "Cancel appointment"}</button></div></section></div>}
  </div>;
}
