import { NextResponse } from "next/server";
import { Prisma, Role } from "@/generated/prisma";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { providerCreateSchema } from "@/lib/schemas";

export async function GET() {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const providers = await prisma.provider.findMany({ orderBy: { user: { name: "asc" } }, include: { user: { select: { id: true, name: true, email: true } }, services: true, _count: { select: { appointments: true } } } });
  return NextResponse.json({ providers });
}

export async function POST(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = providerCreateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const services = await prisma.service.findMany({ where: { id: { in: parsed.data.serviceIds } }, select: { id: true } });
  if (services.length !== new Set(parsed.data.serviceIds).size) return NextResponse.json({ error: "One or more selected services do not exist." }, { status: 400 });
  try {
    const passwordHash = await hash(parsed.data.temporaryPassword, 12);
    const provider = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: Role.STAFF } });
      return tx.provider.create({ data: { userId: user.id, bio: parsed.data.bio || null, services: { connect: services } }, include: { user: { select: { id: true, name: true, email: true } }, services: true } });
    });
    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    throw error;
  }
}
