import Link from "next/link";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-700">Appointment Booking</p>
      <h1 className="text-4xl font-bold tracking-tight">A simple foundation for your clinic or salon.</h1>
      <p className="mt-4 max-w-xl text-slate-600">Project setup, PostgreSQL data model, and secure account access are ready to configure.</p>
      <div className="mt-8 flex gap-4">
        {session?.user ? <Link className="rounded bg-indigo-700 px-4 py-2 text-white" href="/dashboard">Go to dashboard</Link> : <>
          <Link className="rounded bg-indigo-700 px-4 py-2 text-white" href="/register">Create account</Link>
          <Link className="rounded border border-slate-300 px-4 py-2" href="/login">Log in</Link>
        </>}
      </div>
    </main>
  );
}
