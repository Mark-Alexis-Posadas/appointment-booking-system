"use client";
import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import type { EventClickArg, EventSourceInput } from "@fullcalendar/core";

type Detail = { id: string; title: string; customerName: string; serviceName: string; status: string; start: string; end: string };

export function ProviderCalendar({ timezone }: { timezone: string }) {
  const [selected, setSelected] = useState<Detail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  async function updateStatus(status: "COMPLETED" | "NO_SHOW") {
    if (!selected) return;
    setMessage(null);
    const response = await fetch(`/api/appointments/${encodeURIComponent(selected.id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result: { error?: string } = await response.json();
    if (!response.ok) { setMessage(result.error ?? "Unable to update appointment."); return; }
    setMessage(`Appointment marked ${status.toLowerCase().replace("_", " ")}.`);
    setSelected({ ...selected, status });
    window.location.reload();
  }
  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps as { type?: string; customerName?: string; serviceName?: string; status?: string };
    if (props.type !== "appointment") return;
    setSelected({ id: info.event.id, title: info.event.title, customerName: props.customerName ?? "Customer", serviceName: props.serviceName ?? "Service", status: props.status ?? "BOOKED", start: info.event.start?.toISOString() ?? "", end: info.event.end?.toISOString() ?? "" });
  }
  const events: EventSourceInput = { url: "/api/provider/appointments" };
  return <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <section className="relative min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">{loading && <div className="absolute inset-3 z-10 animate-pulse rounded bg-slate-100" aria-label="Loading calendar" />}<FullCalendar plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]} initialView="timeGridWeek" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }} timeZone={timezone} events={events} eventClick={handleEventClick} loading={setLoading} height="auto" nowIndicator listDayFormat={{ weekday: "short", month: "short", day: "numeric" }} /></section>
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Appointment details</h2>{selected ? <><p className="mt-4 font-medium">{selected.serviceName}</p><p className="mt-1 text-sm text-slate-600">Customer: {selected.customerName}</p><p className="mt-3 text-sm">{new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(selected.start))}</p><p className="mt-1 text-sm text-slate-600">Status: {selected.status}</p>{selected.status === "BOOKED" && new Date(selected.start).getTime() <= Date.now() && <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => void updateStatus("COMPLETED")} className="rounded bg-green-700 px-3 py-2 text-sm text-white">Mark completed</button><button onClick={() => void updateStatus("NO_SHOW")} className="rounded bg-slate-700 px-3 py-2 text-sm text-white">Mark no-show</button></div>}</> : <p className="mt-3 text-sm text-slate-500">Select an appointment to see its details.</p>}{message && <p role="status" className="mt-4 text-sm text-indigo-700">{message}</p>}</aside>
  </div>;
}
