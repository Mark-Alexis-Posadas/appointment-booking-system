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

  return <div className="space-y-4">
    <div><label className="block font-semibold">{dateLabel}<input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => onDateChange(event.target.value)} className="mt-2 block rounded border border-slate-300 bg-white p-3" /></label><p className="mt-2 text-xs text-slate-500">Times shown in {timezone}.</p></div>
    <section><h3 className="font-semibold">{timeLabel}</h3>{loading ? <div className="mt-3 h-12 animate-pulse rounded bg-slate-100" aria-label="Loading available times" /> : error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : slots.length === 0 ? <p className="mt-2 rounded border border-dashed p-4 text-sm text-slate-500">No available times on this day.</p> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map((slot) => <button key={slot.startsAt} type="button" aria-pressed={selectedStartsAt === slot.startsAt} onClick={() => onSelect(slot)} className={`rounded border p-3 text-sm ${selectedStartsAt === slot.startsAt ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white hover:border-indigo-500"}`}>{new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt))}</button>)}</div>}</section>
  </div>;
}
