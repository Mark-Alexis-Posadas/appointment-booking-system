import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto max-w-md px-6 py-16">
    <h1 className="text-3xl font-bold">Create your account</h1>
    <p className="mt-2 text-slate-600">New accounts are created with the customer role.</p>
    <RegisterForm callbackUrl={params.callbackUrl} />
    <p className="mt-6 text-sm">Already have an account? <Link className="text-indigo-700 underline" href="/login">Log in</Link></p>
  </main>;
}
