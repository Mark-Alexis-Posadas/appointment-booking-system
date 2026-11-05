import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md px-5 py-12 sm:py-20"><div className="surface-card p-6 sm:p-9">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Get started</p><h1 className="mt-2 text-3xl font-bold">Create your account</h1>
    <p className="mt-2 text-sm text-slate-600">New accounts are created with the customer role.</p>
    <RegisterForm callbackUrl={params.callbackUrl} />
    <p className="mt-6 text-sm text-slate-600">Already have an account? <Link className="font-semibold text-indigo-700 underline" href="/login">Log in</Link></p></div>
  </main>;
}
