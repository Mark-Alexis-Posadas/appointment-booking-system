import { requireRole } from "@/lib/authz";
import { AdminShell } from "@/components/admin-shell";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireRole("ADMIN");
  return <AdminShell name={user.name}>{children}</AdminShell>;
}
