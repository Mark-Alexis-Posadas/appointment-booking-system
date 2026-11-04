import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { providerUpdateSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = providerUpdateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const foundServices = await prisma.service.findMany({ where: { id: { in: parsed.data.serviceIds } }, select: { id: true } });
  if (foundServices.length !== new Set(parsed.data.serviceIds).size) return NextResponse.json({ error: "One or more selected services do not exist." }, { status: 400 });
  try {
    const provider = await prisma.provider.update({ where: { id }, data: { bio: parsed.data.bio || null, user: { update: { name: parsed.data.name } }, services: { set: foundServices } }, include: { user: { select: { id: true, name: true, email: true } }, services: true } });
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const provider = await prisma.provider.findUnique({ where: { id }, select: { id: true, bio: true, user: { select: { id: true } }, _count: { select: { appointments: true } } } });
  if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  if (provider._count.appointments > 0) {
    await prisma.$transaction([
      prisma.provider.update({ where: { id }, data: { isActive: false } }),
      prisma.workingHours.deleteMany({ where: { providerId: id } }),
    ]);
    return NextResponse.json({ success: true, deactivated: true });
  }
  await prisma.$transaction([prisma.provider.delete({ where: { id } }), prisma.user.delete({ where: { id: provider.user.id } })]);
  return NextResponse.json({ success: true, deactivated: false });
}

export async function PATCH(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  if (typeof input.isActive !== "boolean") return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
  try {
    const provider = await prisma.provider.update({ where: { id }, data: { isActive: input.isActive }, select: { id: true, isActive: true } });
    if (!input.isActive) await prisma.workingHours.deleteMany({ where: { providerId: id } });
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    throw error;
  }
}
