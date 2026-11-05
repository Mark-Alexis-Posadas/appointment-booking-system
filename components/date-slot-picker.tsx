"use client";
import { useEffect, useState } from "react";

type Slot = { startsAt: string; endsAt: string };

export function DateSlotPicker({ providerId, serviceId, timezone, minDate, maxDate, date, selectedStartsAt, onDateChange, onSelect, dateLabel = "Choose a date", timeLabel = "Choose a time", refreshKey = 0 }: {
  providerId: string;
  serviceId: string;
  timezone: string;
  minDate: string;
  maxDate: string;
  date: string;
  selectedStartsAt: string;
  onDateChange: (date: string) => void;
  onSelect: (slot: Slot) => void;
  dateLabel?: string;
  timeLabel?: string;
  refreshKey?: number;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!providerId || !serviceId || !date) return () => { active = false; };
    setLoading(true); setError(null); setSlots([]);
    fetch(`/api/providers/${encodeURIComponent(providerId)}/slots?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(serviceId)}`)
      .then(async (response) => {
        const result: { slots?: Slot[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load available times.");
        if (active) setSlots(result.slots ?? []);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load available times."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providerId, serviceId, date, refreshKey]);

  return <div className="space-y-5">
    <div><label className="block font-semibold">{dateLabel}<input aria-label="Appointment date" type="date" min={minDate} max={maxDate} value={date} onChange={(event) => onDateChange(event.target.value)} className="mt-2 block w-full max-w-xs rounded-lg border border-slate-300 bg-white p-3" /></label><p className="mt-2 text-xs text-slate-500">Times shown in {timezone}.</p></div>
    <section aria-live="polite"><h3 className="font-semibold">{timeLabel}</h3>{loading ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Loading available times">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-slate-100" />)}</div> : error ? <p role="alert" className="notice notice-error mt-3">{error}</p> : slots.length === 0 ? <p className="empty-state mt-3 py-6">No available times on this day. Try another date.</p> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{slots.map((slot) => <button key={slot.startsAt} type="button" aria-pressed={selectedStartsAt === slot.startsAt} onClick={() => onSelect(slot)} className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${selectedStartsAt === slot.startsAt ? "border-indigo-700 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50"}`}>{new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt))}</button>)}</div>}</section>
  </div>;
}
