"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateSlotPicker } from "@/components/date-slot-picker";
import { Button, Notice } from "@/components/ui";

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

  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="space-y-5">
    <section className="surface-card p-5"><label htmlFor="booking-service" className="block font-semibold">1. Choose a service</label><p className="mt-1 text-sm text-slate-500">Pick the service you would like to book.</p><select id="booking-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); setProviderId(""); setSelectedSlot(""); setError(null); }} className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3"><option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} min · ${Number(item.price).toFixed(2)}</option>)}</select>{services.length === 0 && <p className="mt-2 text-sm text-slate-500">No services are currently available.</p>}</section>
    {service && <section className="surface-card p-5"><label htmlFor="booking-provider" className="block font-semibold">2. Choose a provider</label><p className="mt-1 text-sm text-slate-500">Available providers for {service.name}.</p><select id="booking-provider" value={providerId} onChange={(event) => { setProviderId(event.target.value); setSelectedSlot(""); setError(null); }} className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3"><option value="">Select a provider</option>{compatibleProviders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{compatibleProviders.length === 0 && <p className="mt-2 text-sm text-slate-500">No active providers offer this service.</p>}</section>}
    {service && provider && <section className="surface-card p-5"><DateSlotPicker providerId={providerId} serviceId={serviceId} timezone={timezone} minDate={minDate} maxDate={maxDate} date={date} selectedStartsAt={selectedSlot} dateLabel="3. Choose a date" timeLabel="4. Choose a time" refreshKey={refreshKey} onDateChange={(value) => { setDate(value); setSelectedSlot(""); setError(null); }} onSelect={(slot: Slot) => { setSelectedSlot(slot.startsAt); setError(null); }} /></section>}
    {error && <Notice kind="error" role="alert">{error}</Notice>}
    </div>
    <aside className="surface-card h-fit p-5 lg:sticky lg:top-24"><h2 className="text-lg font-semibold text-slate-900">Your appointment</h2><p className="mt-1 text-sm text-slate-500">Review the details before confirming.</p>{selectedSlot && service && provider ? <><dl className="mt-5 divide-y divide-slate-100 text-sm"><div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Service</dt><dd className="text-right font-medium">{service.name}</dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Provider</dt><dd className="text-right font-medium">{provider.name}</dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Time</dt><dd className="text-right font-medium">{displayTime(selectedSlot)}<span className="block text-xs font-normal text-slate-500">{timezone}</span></dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Duration</dt><dd className="font-medium">{service.durationMinutes} min</dd></div><div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Price</dt><dd className="font-semibold">${Number(service.price).toFixed(2)}</dd></div></dl><Button type="button" className="mt-5 w-full" disabled={submitting} onClick={() => void confirmBooking()}>{submitting ? "Booking…" : authenticated ? "Confirm booking" : "Log in to confirm"}</Button></> : <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Choose a service, provider, date and time to see your booking summary.</div>}</aside>
  </div>;
}
