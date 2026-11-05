import Link from "next/link";
import { auth, signOut } from "@/auth";

export async function RoleNavigation() {
  const session = await auth();
  const role = session?.user.role;
  const links =
    role === "CUSTOMER"
      ? [
          { href: "/appointments", label: "My appointments" },
          { href: "/book", label: "Book" },
        ]
      : role === "STAFF"
        ? [{ href: "/provider", label: "Schedule" }]
        : role === "ADMIN"
          ? [{ href: "/admin", label: "Admin workspace" }]
          : [{ href: "/book", label: "Book an appointment" }];

  return (
    <header className="site-header">
      <nav
        aria-label="Main navigation"
        className="site-header-inner mx-auto flex items-center justify-between gap-4"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-slate-900">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5.5" width="16" height="15" rx="3" />
              <path d="M8 3.5v4M16 3.5v4M4 10h16M8 14h3m2 0h3m-8 3h3" />
            </svg>
          </span>
          <span>Appointment Booking</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link text-sm font-medium">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {session?.user ? (
            <>
              <span className="max-w-40 truncate text-sm text-slate-600">{session.user.name}</span>
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link text-sm font-medium">Sign in</Link>
              <Link href="/register" className="nav-pill px-4 py-2 text-sm">Create account</Link>
            </>
          )}
        </div>

        <details className="mobile-menu relative md:hidden">
          <summary aria-label="Open navigation menu" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-slate-200 bg-white text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <div className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {link.label}
              </Link>
            ))}
            {session?.user ? (
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }} className="border-t border-slate-100 pt-2">
                <p className="truncate px-3 py-2 text-xs text-slate-500">{session.user.name}</p>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50" type="submit">Sign out</button>
              </form>
            ) : (
              <div className="mt-1 border-t border-slate-100 pt-2">
                <Link href="/login" className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign in</Link>
                <Link href="/register" className="block rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">Create account</Link>
              </div>
            )}
          </div>
        </details>
      </nav>
    </header>
  );
}
