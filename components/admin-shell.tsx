"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/admin", label: "Overview", icon: "grid" },
  { href: "/admin/appointments", label: "Appointments", icon: "calendar" },
  { href: "/admin/providers", label: "Providers", icon: "users" },
  { href: "/admin/services", label: "Services", icon: "briefcase" },
  { href: "/admin/schedules", label: "Schedules", icon: "clock" },
] as const;

function Icon({ name }: { name: (typeof navigation)[number]["icon"] }) {
  const paths: Record<(typeof navigation)[number]["icon"], ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m2 0h3m-8 3h3"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20m-1-14.5a3 3 0 0 1 0 5.8M17 14h.5a3.5 3.5 0 0 1 3.5 3.5V20"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7m-13 5h18m-11-1v2h4v-2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">{paths[name]}</svg>;
}

export function AdminShell({ children, name }: { children: ReactNode; name?: string | null }) {
  const pathname = usePathname();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand mb-6 px-3">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">Clinic administration</p>
        </div>
        <nav aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="admin-nav-link"><Icon name={item.icon}/>{item.label}</Link>;
          })}
        </nav>
        <div className="admin-sidebar-brand mt-8 border-t border-slate-200 pt-5">
          <p className="px-3 text-xs text-slate-500">Signed in as</p>
          <p className="mt-1 truncate px-3 text-sm font-semibold text-slate-700">{name ?? "Administrator"}</p>
          <Link href="/dashboard" className="mt-3 block rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">Back to account</Link>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
