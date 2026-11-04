import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getAvailabilityConfig } from "@/lib/availability";
import { AdminAppointments } from "@/components/admin-appointments";

export default async function AdminAppointmentsPage() {
  await requireRole("ADMIN");
  const [providers, services] = await Promise.all([
    prisma.provider.findMany({ where: { isActive: true }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <AdminAppointments providers={providers.map((provider) => ({ id: provider.id, name: provider.user.name }))} services={services} timezone={getAvailabilityConfig().businessTimezone} />;
}
