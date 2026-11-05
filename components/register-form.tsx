"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function RegisterForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }) });
      const result: { error?: string } = await response.json();
      if (!response.ok) { setError(result.error ?? "Registration failed."); return; }
      const query = new URLSearchParams({ registered: "1" });
      if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) query.set("callbackUrl", callbackUrl);
      router.push(`/login?${query.toString()}`);
    } catch { setError("Unable to reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={handleSubmit} className="mt-7 space-y-4">
    <label className="block text-sm font-medium">Name<input required minLength={2} maxLength={100} name="name" autoComplete="name" placeholder="Your name" className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
    <label className="block text-sm font-medium">Email<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
    <label className="block text-sm font-medium">Password<input required minLength={8} type="password" name="password" autoComplete="new-password" placeholder="At least 8 characters" className="mt-1 w-full rounded border border-slate-300 bg-white p-2" /></label>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    <Button disabled={busy} className="w-full" type="submit">{busy ? "Creating account…" : "Create account"}</Button>
  </form>;
}
