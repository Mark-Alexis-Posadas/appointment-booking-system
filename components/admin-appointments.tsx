"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";

type Provider = { id: string; name: string };
type Service = { id: string; name: string };
type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  customer: { name: string; email: string };
  provider: { user: { name: string } };
  service: { name: string; price: string };
};
type Result = {
  appointments?: Appointment[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  error?: string;
};

export function AdminAppointments({
  providers,
  services,
  timezone,
}: {
  providers: Provider[];
  services: Service[];
  timezone: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<Result>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const search = params.toString();
  useEffect(() => {
    if (!cancelTarget) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyId) setCancelTarget(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelTarget, busyId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/appointments${search ? `?${search}` : ""}`)
      .then(async (response) => {
        const data: Result = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Unable to load appointments.");
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to load appointments.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of [
      "dateFrom",
      "dateTo",
      "providerId",
      "serviceId",
      "status",
      "search",
    ] as const) {
      const value = String(data.get(key) ?? "");
      if (value) next.set(key, value);
    }
    router.push(`/admin/appointments${next.size ? `?${next.toString()}` : ""}`);
  }

  async function update(
    id: string,
    action: "cancel" | "COMPLETED" | "NO_SHOW",
  ) {
    const destructive = action === "cancel";
    if (destructive) {
      const appointment = result.appointments?.find((item) => item.id === id);
      if (appointment) setCancelTarget(appointment);
      return;
    }
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action }),
        });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to update appointment.");
      setNotice(`Appointment marked ${action.toLowerCase().replace("_", " ")}.`);
      router.refresh();
      const reload = await fetch(`/api/admin/appointments${search ? `?${search}` : ""}`);
      if (!reload.ok) throw new Error("Appointment updated, but the list could not be refreshed.");
      setResult((await reload.json()) as Result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update appointment.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(id)}/cancel`, { method: "PATCH" });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to cancel appointment.");
      setNotice("Appointment cancelled.");
      setCancelTarget(null);
      router.refresh();
      const reload = await fetch(`/api/admin/appointments${search ? `?${search}` : ""}`);
      if (!reload.ok) throw new Error("Appointment cancelled, but the list could not be refreshed.");
      setResult((await reload.json()) as Result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel appointment.");
    } finally {
      setBusyId(null);
    }
  }

  const page = result.pagination?.page ?? Number(params.get("page") ?? 1);
  const totalPages = result.pagination?.totalPages ?? 1;
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(search);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    return `/admin/appointments${next.size ? `?${next.toString()}` : ""}`;
  };
  return (
    <main>
      <PageHeader title="Appointments" description={`Filter and manage all bookings. Times use ${timezone}.`} />
      <form
        onSubmit={applyFilters}
        className="surface-card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-sm">
          From
          <input
            name="dateFrom"
            type="date"
            defaultValue={params.get("dateFrom") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          To
          <input
            name="dateTo"
            type="date"
            defaultValue={params.get("dateTo") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          Provider
          <select
            name="providerId"
            defaultValue={params.get("providerId") ?? ""}
            className="mt-1 block w-full rounded border bg-white p-2"
          >
            <option value="">All providers</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Service
          <select
            name="serviceId"
            defaultValue={params.get("serviceId") ?? ""}
            className="mt-1 block w-full rounded border bg-white p-2"
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Status
          <select
            name="status"
            defaultValue={params.get("status") ?? ""}
            className="mt-1 block w-full rounded border bg-white p-2"
          >
            <option value="">All statuses</option>
            {["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Customer name or email
          <input
            name="search"
            defaultValue={params.get("search") ?? ""}
            className="mt-1 block w-full rounded border p-2"
          />
        </label>
        <button className="min-h-10 self-end rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
          Apply filters
        </button>
      </form>
      {(notice || error) && !cancelTarget && (
        <p
          role="status"
          className={`notice mt-4 ${error ? "notice-error" : "notice-success"}`}
        >
          {error ?? notice}
        </p>
      )}
      <div className="table-wrap mt-6">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "Date/time",
                "Customer",
                "Service",
                "Provider",
                "Price",
                "Status",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, index) => (
                <tr key={index}>
                  <td colSpan={7} className="p-4">
                    <div className="h-5 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : (result.appointments ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No appointments match these filters.
                </td>
              </tr>
            ) : (
              result.appointments?.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {new Intl.DateTimeFormat(undefined, {
                      timeZone: timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.startsAt))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{item.customer.name}</span>
                    <span className="text-xs text-slate-500">
                      {item.customer.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.service.name}</td>
                  <td className="px-4 py-3">{item.provider.user.name}</td>
                  <td className="px-4 py-3">
                    ${Number(item.service.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.status}/></td>
                  <td className="px-4 py-3">
                    {item.status === "BOOKED" && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busyId === item.id}
                          onClick={() => void update(item.id, "cancel")}
                          className="rounded-md px-2 py-1 text-red-700 hover:bg-red-50"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={busyId === item.id}
                          onClick={() => void update(item.id, "COMPLETED")}
                          className="rounded-md px-2 py-1 text-green-700 hover:bg-green-50"
                        >
                          Complete
                        </button>
                        <button
                          disabled={busyId === item.id}
                          onClick={() => void update(item.id, "NO_SHOW")}
                          className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
                        >
                          No-show
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {cancelTarget && <div role="dialog" aria-modal="true" aria-labelledby="admin-cancel-title" className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setCancelTarget(null); }}><section className="dialog-panel max-w-md"><h2 id="admin-cancel-title" className="text-lg font-bold">Cancel appointment?</h2><p className="mt-2 text-sm text-slate-600">Cancel {cancelTarget.customer.name}&apos;s {cancelTarget.service.name} appointment?</p>{error && <p role="alert" className="notice notice-error mt-4">{error}</p>}<div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button type="button" disabled={Boolean(busyId)} onClick={() => setCancelTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2">Keep appointment</button><button type="button" disabled={Boolean(busyId)} onClick={() => void confirmCancel()} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busyId ? "Cancelling…" : "Cancel appointment"}</button></div></section></div>}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {result.pagination?.total ?? 0} appointments · page {page} of{" "}
          {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => router.push(pageHref(page - 1))}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => router.push(pageHref(page + 1))}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
