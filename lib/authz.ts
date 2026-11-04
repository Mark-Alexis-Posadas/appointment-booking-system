import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma";
import { auth } from "@/auth";

export async function requireRole(...allowedRoles: Role[]) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return session.user;
}
