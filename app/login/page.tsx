import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string; callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md px-6 py-16">
    <h1 className="text-3xl font-bold">Log in</h1>
    {params.registered === "1" && <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">Account created. You can now log in.</p>}
    {params.error && <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">That login link could not be used. Please try again.</p>}
    <LoginForm callbackUrl={params.callbackUrl} />
    <p className="mt-6 text-sm">Need an account? <Link className="text-indigo-700 underline" href={params.callbackUrl ? `/register?callbackUrl=${encodeURIComponent(params.callbackUrl)}` : "/register"}>Register</Link></p>
  </main>;
}
