import Link from "next/link";
import { requireRole } from "@/lib/authz";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/schedules", label: "Schedules" },
  { href: "/admin/appointments", label: "Appointments" },
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("ADMIN");
  return <div className="min-h-screen md:flex">
    <aside className="w-full border-b border-slate-200 bg-white p-4 md:min-h-screen md:w-60 md:border-b-0 md:border-r">
      <Link href="/admin" className="text-lg font-bold text-indigo-800">Admin panel</Link>
      <nav className="mt-4 flex gap-2 overflow-x-auto md:flex-col">
        {links.map((link) => <Link key={link.label} href={link.href} className="shrink-0 rounded px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-800">{link.label}</Link>)}
      </nav>
      <Link href="/dashboard" className="mt-4 inline-block px-3 py-2 text-sm text-slate-500">Back to account</Link>
    </aside>
    <div className="min-w-0 flex-1 p-5 md:p-8">{children}</div>
  </div>;
}
