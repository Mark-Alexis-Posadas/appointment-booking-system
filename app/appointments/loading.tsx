export default function AppointmentsLoading() {
  return <main className="mx-auto max-w-5xl px-5 py-10 md:px-8"><div className="h-9 w-64 animate-pulse rounded bg-slate-200" /><div className="mt-6 h-12 animate-pulse rounded bg-slate-100" /><div className="mt-6 grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-40 animate-pulse rounded-lg bg-slate-100" />)}</div></main>;
}
