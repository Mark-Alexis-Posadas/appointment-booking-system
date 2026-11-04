"use client";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true);
    const form = new FormData(event.currentTarget);
    const destination = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard";
    try {
      const result = await signIn("credentials", { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), redirect: false, redirectTo: destination });
      if (result?.error) { setError("Email or password is incorrect."); return; }
      window.location.assign(destination);
    } catch { setError("Unable to log in right now. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={handleSubmit} className="mt-8 space-y-4">
    <label className="block text-sm font-medium">Email<input required type="email" name="email" autoComplete="email" className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
    <label className="block text-sm font-medium">Password<input required type="password" name="password" autoComplete="current-password" className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded bg-indigo-700 p-2 font-semibold text-white disabled:opacity-60" type="submit">{busy ? "Logging in…" : "Log in"}</button>
  </form>;
}
