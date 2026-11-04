"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

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
    if (!window.confirm("Remove this time-off period?")) return;
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
      <h1 className="mt-3 text-3xl font-bold">Schedule: {provider.name}</h1>
      <p className="mt-2 text-sm text-slate-600">
        Weekly times use the business timezone: <strong>{timezone}</strong>.
      </p>
      {(message || error) && (
        <p
          role="status"
          className={`mt-4 rounded p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
        >
          {error ?? message}
        </p>
      )}
      <form onSubmit={saveSchedule} className="mt-6 space-y-3">
        {days.map((day) => (
          <section
            key={day.weekday}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{weekdays[day.weekday]}</h2>
              <button
                type="button"
                onClick={() => addRange(day.weekday)}
                className="text-sm text-indigo-700 underline"
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
                    className="flex flex-wrap items-end gap-2"
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
                        className="mt-1 block rounded border p-2 text-sm"
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
                        className="mt-1 block rounded border p-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeRange(day.weekday, index)}
                      className="px-2 py-2 text-sm text-red-700 underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
        <button
          disabled={busy}
          className="rounded bg-indigo-700 px-4 py-2 text-white"
        >
          {busy ? "Saving…" : "Save working hours"}
        </button>
      </form>
      <section className="mt-10">
        <h2 className="text-2xl font-bold">Time off</h2>
        <p className="mt-1 text-sm text-slate-600">
          Dates are entered as local business time and saved as UTC instants.
        </p>
        <form
          onSubmit={addTimeOff}
          className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <label className="text-sm">
            Starts
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <label className="text-sm">
            Ends
            <input
              name="endsAt"
              type="datetime-local"
              required
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Reason
            <input
              name="reason"
              maxLength={500}
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
          <button
            disabled={busy}
            className="w-fit rounded bg-indigo-700 px-4 py-2 text-white"
          >
            {busy ? "Saving…" : "Add time off"}
          </button>
        </form>
        {timeOff.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No time off scheduled.</p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border border-slate-200 bg-white">
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
                  onClick={() => void removeTimeOff(period.id)}
                  className="text-sm text-red-700 underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
