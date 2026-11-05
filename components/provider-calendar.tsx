"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import type { EventClickArg, EventInput, EventSourceInput } from "@fullcalendar/core";
import { Button, Notice, StatusBadge } from "@/components/ui";

type Detail = { id: string; title: string; customerName: string; serviceName: string; status: string; start: string; end: string };

export function ProviderCalendar({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Detail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedEvents, setHasLoadedEvents] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const calendarRef = useRef<FullCalendar | null>(null);
  async function updateStatus(status: "COMPLETED" | "NO_SHOW") {
    if (!selected) return;
    setMessage(null); setActionError(null); setBusy(true);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(selected.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update appointment.");
      setMessage(`Appointment marked ${status.toLowerCase().replace("_", " ")}.`);
      setSelected({ ...selected, status });
      calendarRef.current?.getApi().refetchEvents();
      router.refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to update appointment.");
    } finally {
      setBusy(false);
    }
  }
  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps as { type?: string; customerName?: string; serviceName?: string; status?: string };
    if (props.type !== "appointment") return;
    setSelected({ id: info.event.id, title: info.event.title, customerName: props.customerName ?? "Customer", serviceName: props.serviceName ?? "Service", status: props.status ?? "BOOKED", start: info.event.start?.toISOString() ?? "", end: info.event.end?.toISOString() ?? "" });
  }, []);
  const events = useMemo<EventSourceInput>(() => ({ url: "/api/provider/appointments" }), []);
  const handleLoading = useCallback((active: boolean) => {
    setLoading(active);
    if (active) setCalendarError(null);
  }, []);
  const handleEventSourceSuccess = useCallback((content: EventInput[]) => {
    setEventCount(content.length);
    setHasLoadedEvents(true);
    setCalendarError(null);
    return content;
  }, []);
  const handleEventSourceFailure = useCallback(() => {
    setCalendarError("Unable to load calendar events. Check your connection and try again.");
    setHasLoadedEvents(true);
  }, []);
  return <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <section aria-busy={loading} className="calendar-frame min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
      {loading && <div role="status" aria-live="polite" className="notice notice-info mb-3">Loading calendar…</div>}
      {calendarError && <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><Notice kind="error" role="alert">{calendarError}</Notice><Button variant="secondary" onClick={() => calendarRef.current?.getApi().refetchEvents()}>Retry</Button></div>}
      {!loading && !calendarError && hasLoadedEvents && eventCount === 0 && <p role="status" className="notice notice-info mb-3">No appointments or time off in this calendar view.</p>}
      <div className="overflow-x-auto"><div className="min-w-[600px]"><FullCalendar ref={calendarRef} plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]} initialView="timeGridWeek" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }} timeZone={timezone} events={events} eventClick={handleEventClick} loading={handleLoading} eventSourceSuccess={handleEventSourceSuccess} eventSourceFailure={handleEventSourceFailure} height="auto" nowIndicator listDayFormat={{ weekday: "short", month: "short", day: "numeric" }} /></div></div>
    </section>
    <aside className="surface-card h-fit p-5"><h2 className="text-lg font-semibold">Appointment details</h2>{selected ? <><div className="mt-4 flex items-start justify-between gap-2"><p className="font-medium">{selected.serviceName}</p><StatusBadge status={selected.status}/></div><p className="mt-1 text-sm text-slate-600">Customer: {selected.customerName}</p><p className="mt-3 text-sm">{new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.start))}</p>{selected.status === "BOOKED" && new Date(selected.start).getTime() <= Date.now() && <div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void updateStatus("COMPLETED")} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">Mark completed</button><button disabled={busy} onClick={() => void updateStatus("NO_SHOW")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Mark no-show</button></div>}</> : <p className="mt-3 text-sm text-slate-500">Select an appointment to see its details.</p>}{message && <p role="status" className="notice notice-success mt-4">{message}</p>}{actionError && <p role="alert" className="notice notice-error mt-4">{actionError}</p>}</aside>
  </div>;
}
