import Link from "next/link";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  const destination = session?.user.role === "ADMIN" ? "/admin" : session?.user.role === "STAFF" ? "/provider" : session?.user ? "/appointments" : "/book";
  return (
    <main className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <section className="grid items-center gap-12 rounded-3xl border border-slate-200 bg-white px-7 py-10 shadow-sm sm:px-12 lg:grid-cols-[1.05fr_.95fr] lg:px-16 lg:py-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-indigo-800">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />Appointments, organized
          </span>
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-[1.08] tracking-[-.045em] text-slate-900 sm:text-5xl lg:text-[3.6rem]">
            A smoother way to manage your time.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
            Find a service, choose a provider, and book an available time. Your appointments and schedule stay easy to manage in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={destination} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800">
              {session?.user ? "Open your workspace" : "Book an appointment"}
              <span className="ml-3" aria-hidden="true">→</span>
            </Link>
            {!session?.user && <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign in</Link>}
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <span>✓ Clear availability</span><span>✓ Secure account access</span><span>✓ Manage bookings anytime</span>
          </div>
        </div>
        <div aria-label="Appointment schedule preview" className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2rem] bg-indigo-50" />
          <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Example schedule</p><p className="mt-1 text-lg font-bold text-slate-800">A day, well planned</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700" aria-hidden="true">▦</span>
            </div>
            <div className="mt-4 space-y-3">
              {[{ time: "09:30", name: "Initial consultation", state: "Booked", color: "bg-indigo-500" }, { time: "11:00", name: "Follow-up visit", state: "Upcoming", color: "bg-teal-500" }, { time: "14:15", name: "Standard treatment", state: "Scheduled", color: "bg-violet-500" }].map((item) => (
                <div key={item.time} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3.5">
                  <p className="w-12 shrink-0 text-sm font-bold tabular-nums text-slate-600">{item.time}</p>
                  <span className={`h-9 w-1 rounded-full ${item.color}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.name}</p><p className="mt-0.5 text-xs text-slate-500">Appointment</p></div>
                  <span className="hidden rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline">{item.state}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600"><span>Appointments are confirmed against live availability</span><span className="font-bold text-indigo-700">✓</span></div>
          </div>
        </div>
      </section>
      <section className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-3">
        {[{ n: "01", title: "Choose your service", body: "Browse available services and find the right fit." }, { n: "02", title: "Pick a time", body: "See current openings in your business timezone." }, { n: "03", title: "Manage with ease", body: "Review, cancel, or reschedule your appointments." }].map((item) => <article key={item.n} className="flex gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-indigo-700 shadow-sm ring-1 ring-slate-200">{item.n}</span><div><h2 className="text-sm font-bold text-slate-800">{item.title}</h2><p className="mt-1.5 text-sm leading-6 text-slate-600">{item.body}</p></div></article>)}
      </section>
    </main>
  );
}
