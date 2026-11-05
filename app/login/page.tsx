import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string; callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
    <div className="surface-card p-6 sm:p-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Welcome back</p><h1 className="mt-2 text-3xl font-bold">Log in</h1><p className="mt-2 text-sm text-slate-500">Access your appointments and account.</p>
    {params.registered === "1" && <p className="notice notice-success mt-4">Account created. You can now log in.</p>}
    {params.error && <p className="notice notice-error mt-4">That login link could not be used. Please try again.</p>}
    <LoginForm callbackUrl={params.callbackUrl} />
    <p className="mt-6 text-sm text-slate-600">Need an account? <Link className="font-semibold text-indigo-700 underline" href={params.callbackUrl ? `/register?callbackUrl=${encodeURIComponent(params.callbackUrl)}` : "/register"}>Register</Link></p></div>
  </main>;
}
