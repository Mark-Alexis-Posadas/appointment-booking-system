import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export type AdminAuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function requireAdminApi(): Promise<AdminAuthResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  if (session.user.role !== "ADMIN") return { ok: false, response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  return { ok: true, session };
}

export async function readJson(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, data: await request.json() as unknown };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}
