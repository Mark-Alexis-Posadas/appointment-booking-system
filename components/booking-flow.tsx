"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateSlotPicker } from "@/components/date-slot-picker";

type Service = { id: string; name: string; durationMinutes: number; price: string };
type Provider = { id: string; name: string; serviceIds: string[] };
type Slot = { startsAt: string; endsAt: string };
type Props = { services: Service[]; providers: Provider[]; timezone: string; minDate: string; maxDate: string; authenticated: boolean; initialSelection: { serviceId?: string; providerId?: string; date?: string; startsAt?: string } };

export function BookingFlow({ services, providers, timezone, minDate, maxDate, authenticated, initialSelection }: Props) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(initialSelection.serviceId ?? "");
  const [providerId, setProviderId] = useState(initialSelection.providerId ?? "");
  const [date, setDate] = useState(initialSelection.date ?? minDate);
  const [selectedSlot, setSelectedSlot] = useState(initialSelection.startsAt ?? "");
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = services.find((item) => item.id === serviceId);
  const provider = providers.find((item) => item.id === providerId);
  const compatibleProviders = useMemo(() => providers.filter((item) => item.serviceIds.includes(serviceId)), [providers, serviceId]);

  async function confirmBooking() {
    if (!service || !provider || !selectedSlot) return;
    const selection = new URLSearchParams({ serviceId, providerId, date, startsAt: selectedSlot });
    const returnPath = `/book?${selection.toString()}`;
    if (!authenticated) { router.push(`/login?callbackUrl=${encodeURIComponent(returnPath)}`); return; }
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId, serviceId, startsAt: selectedSlot }) });
      const result: { appointment?: { id: string }; error?: string } = await response.json();
      if (response.status === 409) { setError("That time was just taken. Choose another available time."); setSelectedSlot(""); setRefreshKey((value) => value + 1); return; }
      if (!response.ok || !result.appointment) throw new Error(result.error ?? "Unable to complete booking.");
      router.push(`/book/confirmation/${encodeURIComponent(result.appointment.id)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to complete booking."); }
    finally { setSubmitting(false); }
  }

  function displayTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  }

  return <div className="mt-8 space-y-7">
    <section><label htmlFor="booking-service" className="block font-semibold">1. Choose a service</label><select id="booking-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setProviderId(""); setSelectedSlot(""); setError(null); }} className="mt-2 w-full rounded border border-slate-300 bg-white p-3"><option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min · ${Number(item.price).toFixed(2)}</option>)}</select>{services.length === 0 && <p className="mt-2 text-sm text-slate-500">No services are currently available.</p>}</section>
    {service && <section><label htmlFor="booking-provider" className="block font-semibold">2. Choose a provider</label><select id="booking-provider" value={providerId} onChange={(event) => { setProviderId(event.target.value); setSelectedSlot(""); setError(null); }} className="mt-2 w-full rounded border border-slate-300 bg-white p-3"><option value="">Select a provider</option>{compatibleProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{compatibleProviders.length === 0 && <p className="mt-2 text-sm text-slate-500">No active providers offer this service.</p>}</section>}
    {service && provider && <DateSlotPicker providerId={providerId} serviceId={serviceId} timezone={timezone} minDate={minDate} maxDate={maxDate} date={date} selectedStartsAt={selectedSlot} dateLabel="3. Choose a date" timeLabel="4. Choose a time" refreshKey={refreshKey} onDateChange={(value) => { setDate(value); setSelectedSlot(""); setError(null); }} onSelect={(slot: Slot) => { setSelectedSlot(slot.startsAt); setError(null); }} />}
    {selectedSlot && service && provider && <section className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-semibold">5. Review and confirm</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Service</dt><dd>{service.name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Provider</dt><dd>{provider.name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Time</dt><dd>{displayTime(selectedSlot)} ({timezone})</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Duration</dt><dd>{service.durationMinutes} min</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Price</dt><dd>${Number(service.price).toFixed(2)}</dd></div></dl><button type="button" onClick={() => void confirmBooking()} disabled={submitting} className="mt-5 w-full rounded bg-indigo-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Booking…" : authenticated ? "Confirm booking" : "Log in to confirm"}</button></section>}
    {error && <p role="status" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>;
}
