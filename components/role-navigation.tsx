import Link from "next/link";
import { auth } from "@/auth";

export async function RoleNavigation() {
  const session = await auth();
  const role = session?.user.role;
  const links = role === "CUSTOMER" ? [{ href: "/book", label: "Book" }, { href: "/appointments", label: "My appointments" }] : role === "STAFF" ? [{ href: "/provider", label: "Provider dashboard" }] : role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : [{ href: "/book", label: "Book" }];
  return <header className="border-b border-slate-200 bg-white"><nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 md:px-8"><Link href="/" className="font-bold text-indigo-800">Appointment Booking</Link><div className="flex items-center gap-4 text-sm">{links.map((link) => <Link key={link.href} className="font-medium text-slate-700 hover:text-indigo-800" href={link.href}>{link.label}</Link>)}{session?.user ? <span className="hidden text-slate-500 sm:inline">{session.user.name}</span> : <><Link href="/login" className="text-slate-600">Log in</Link><Link href="/register" className="rounded bg-indigo-700 px-3 py-2 text-white">Register</Link></>}</div></nav></header>;
}
