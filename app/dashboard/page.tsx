import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");
  if (session.user.role === "STAFF") redirect("/provider");
  return <main className="mx-auto max-w-2xl px-6 py-16">
    <h1 className="text-3xl font-bold">Dashboard</h1>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p>Welcome, <strong>{session.user.name}</strong>.</p>
      <p className="mt-2 text-slate-600">Your role: <strong>{session.user.role}</strong></p>
    </section>
    <form className="mt-6" action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
      <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">Log out</button>
    </form>
  </main>;
}
