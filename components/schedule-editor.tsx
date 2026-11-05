"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, Notice, PageHeader } from "@/components/ui";

type Range = { startTime: string; endTime: string };
type WorkingHour = Range & { id: string; weekday: number };
type TimeOff = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  reason: string | null;
};
type Day = { weekday: number; ranges: Range[] };
type ProviderSchedule = {
  id: string;
  name: string;
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
};
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function businessLocalToUtc(value: string, timezone: string): string {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) throw new Error("Enter a valid date and time.");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const desiredUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  let guess = desiredUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const representedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    guess += desiredUtc - representedUtc;
  }
  return new Date(guess).toISOString();
}

export function ScheduleEditor({
  provider,
  timezone,
}: {
  provider: ProviderSchedule;
  timezone: string;
}) {
  const [days, setDays] = useState<Day[]>(
    weekdays.map((_, weekday) => ({
      weekday,
      ranges: provider.workingHours
        .filter((hour) => hour.weekday === weekday)
        .map(({ startTime, endTime }) => ({ startTime, endTime })),
    })),
  );
  const [timeOff, setTimeOff] = useState(provider.timeOff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingTimeOffId, setRemovingTimeOffId] = useState<string | null>(null);
  const removingTimeOff = timeOff.find((period) => period.id === removingTimeOffId);

  function updateRange(
    weekday: number,
    rangeIndex: number,
    field: keyof Range,
    value: string,
  ) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: day.ranges.map((range, index) =>
                index === rangeIndex ? { ...range, [field]: value } : range,
              ),
            }
          : day,
      ),
    );
  }
  function addRange(weekday: number) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: [...day.ranges, { startTime: "09:00", endTime: "17:00" }],
            }
          : day,
      ),
    );
  }
  function removeRange(weekday: number, rangeIndex: number) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: day.ranges.filter((_, index) => index !== rangeIndex),
            }
          : day,
      ),
    );
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/providers/${provider.id}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        },
      );
      const result: { error?: string; details?: Record<string, string[]> } =
        await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save schedule.");
      setMessage("Working hours saved.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save schedule.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addTimeOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const startsAt = businessLocalToUtc(
        String(form.get("startsAt")),
        timezone,
      );
      const endsAt = businessLocalToUtc(String(form.get("endsAt")), timezone);
      const response = await fetch(
        `/api/admin/providers/${provider.id}/schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startsAt,
            endsAt,
            reason: String(form.get("reason") ?? ""),
          }),
        },
      );
      const result: {
        error?: string;
        warning?: string | null;
        timeOff?: TimeOff;
        overlappingAppointments?: { startsAt: string; endsAt: string }[];
      } = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to add time off.");
      if (result.timeOff)
        setTimeOff((current) =>
          [...current, result.timeOff!].sort(
            (a, b) =>
              new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
        );
      setMessage(result.warning ?? "Time off added.");
      event.currentTarget.reset();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to add time off.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeTimeOff(id: string) {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/providers/${provider.id}/schedule`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        },
      );
      const result: { error?: string } = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to remove time off.");
      setTimeOff((current) => current.filter((period) => period.id !== id));
      setRemovingTimeOffId(null);
      setMessage("Time off removed.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to remove time off.",
      );
    }
  }

  return (
    <div>
      <Link
        href="/admin/providers"
        className="text-sm text-indigo-700 underline"
      >
        ← Providers
      </Link>
      <PageHeader title={`Schedule: ${provider.name}`} description={`Weekly times use the business timezone: ${timezone}.`} />
      {(message || error) && (
        <Notice kind={error ? "error" : "success"} role={error ? "alert" : "status"}>{error ?? message}</Notice>
      )}
      <form onSubmit={saveSchedule} className="mt-6 space-y-3">
        {days.map((day) => (
          <section
            key={day.weekday}
            className="surface-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{weekdays[day.weekday]}</h2>
              <button
                type="button"
                onClick={() => addRange(day.weekday)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Add time range
              </button>
            </div>
            {day.ranges.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Closed</p>
            ) : (
              <div className="mt-3 space-y-2">
                {day.ranges.map((range, index) => (
                  <div
                    key={`${day.weekday}-${index}`}
                    className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3"
                  >
                    <label className="text-xs text-slate-600">
                      From
                      <input
                        aria-label={`${weekdays[day.weekday]} range ${index + 1} start`}
                        type="time"
                        required
                        value={range.startTime}
                        onChange={(event) =>
                          updateRange(
                            day.weekday,
                            index,
                            "startTime",
                            event.target.value,
                          )
                        }
                        className="mt-1 block rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      To
                      <input
                        aria-label={`${weekdays[day.weekday]} range ${index + 1} end`}
                        type="time"
                        required
                        value={range.endTime}
                        onChange={(event) =>
                          updateRange(
                            day.weekday,
                            index,
                            "endTime",
                            event.target.value,
                          )
                        }
                        className="mt-1 block rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRange(day.weekday, index)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
        <Button disabled={busy}>{busy ? "Saving…" : "Save working hours"}</Button>
      </form>
      <section className="mt-10">
        <h2 className="section-title text-xl">Time off</h2>
        <p className="mt-1 text-sm text-slate-600">
          Dates are entered as local business time and saved as UTC instants.
        </p>
        <form
          onSubmit={addTimeOff}
          className="surface-card mt-4 grid gap-3 p-4 sm:grid-cols-2"
        >
          <label className="text-sm">
            Starts
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 block w-full rounded-lg border p-2.5"
            />
          </label>
          <label className="text-sm">
            Ends
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="mt-1 block w-full rounded-lg border p-2.5"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Reason
            <input
              name="reason"
              maxLength={500}
              className="mt-1 block w-full rounded-lg border p-2.5"
            />
          </label>
          <Button disabled={busy} className="w-fit">{busy ? "Saving…" : "Add time off"}</Button>
        </form>
        {timeOff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No time off scheduled.</p>
        ) : (
          <ul className="surface-card mt-4 divide-y divide-slate-100">
            {timeOff.map((period) => (
              <li
                key={period.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(period.startsAt).toLocaleString()} –{" "}
                    {new Date(period.endsAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-slate-500">
                    {period.reason || "No reason given"}
                  </p>
                </div>
                <button
                  onClick={() => setRemovingTimeOffId(period.id)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {removingTimeOff && <div role="dialog" aria-modal="true" aria-labelledby="remove-timeoff-title" className="dialog-backdrop"><section className="dialog-panel max-w-md"><h2 id="remove-timeoff-title" className="text-lg font-bold">Remove time off?</h2><p className="mt-2 text-sm text-slate-600">This will make {new Date(removingTimeOff.startsAt).toLocaleString()}–{new Date(removingTimeOff.endsAt).toLocaleString()} available for new bookings.</p>{error && <Notice kind="error" role="alert">{error}</Notice>}<div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><Button type="button" variant="secondary" disabled={busy} onClick={() => setRemovingTimeOffId(null)}>Keep time off</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void removeTimeOff(removingTimeOff.id)}>{busy ? "Removing…" : "Remove time off"}</Button></div></section></div>}
    </div>
  );
}
