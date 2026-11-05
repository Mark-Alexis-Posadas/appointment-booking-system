import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/provider");
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="page-heading">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Customer account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Welcome back, {session.user.name?.split(" ")[0] ?? "there"}.</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Your appointments are ready when you are. Book a new visit or review your upcoming plans.</p>
      </header>
      <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <article className="surface-card overflow-hidden p-6 sm:p-8">
          <span className="text-xs font-bold uppercase tracking-[.12em] text-indigo-700">Appointments</span>
          <h2 className="mt-3 max-w-lg text-2xl font-bold tracking-tight text-slate-900">Keep your next visit on track.</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">View the details, cancel within the available window, or choose a new time with the same provider.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/appointments" className="inline-flex min-h-10 items-center rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800">View appointments <span className="ml-2" aria-hidden="true">→</span></Link>
            <Link href="/book" className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Book a visit</Link>
          </div>
        </article>
        <aside className="surface-card p-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Account details</p>
          <p className="mt-3 font-semibold text-slate-800">{session.user.name}</p>
          <p className="mt-1 break-all text-sm text-slate-500">{session.user.email}</p>
          <p className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Customer account</p>
          <form className="mt-6 border-t border-slate-100 pt-4" action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <Button type="submit" variant="secondary">Sign out</Button>
          </form>
        </aside>
      </section>
    </main>
  );
}
