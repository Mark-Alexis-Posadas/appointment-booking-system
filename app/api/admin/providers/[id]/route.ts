import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { providerUpdateSchema } from "@/lib/schemas";
import { lockProviderRows, lockServiceRows } from "@/lib/prisma-booking";

type Context = { params: Promise<{ id: string }> };

async function lockProvider(tx: Prisma.TransactionClient, id: string) {
  return lockProviderRows(tx, [id]);
}

export async function PUT(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = providerUpdateSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const foundServices = await prisma.service.findMany({ where: { id: { in: parsed.data.serviceIds } }, select: { id: true } });
  if (foundServices.length !== new Set(parsed.data.serviceIds).size) return NextResponse.json({ error: "One or more selected services do not exist." }, { status: 400 });
  try {
    const provider = await prisma.$transaction(async (tx) => {
      const locked = await lockProvider(tx, id);
      if (!locked.length) return { kind: "provider-missing" as const };
      const lockedServices = await lockServiceRows(tx, parsed.data.serviceIds);
      if (lockedServices.length !== new Set(parsed.data.serviceIds).size) return { kind: "service-missing" as const };
      const updated = await tx.provider.update({ where: { id }, data: { bio: parsed.data.bio || null, user: { update: { name: parsed.data.name } }, services: { set: foundServices } }, include: { user: { select: { id: true, name: true, email: true } }, services: true } });
      return { kind: "updated" as const, provider: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (provider.kind === "provider-missing") return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    if (provider.kind === "service-missing") return NextResponse.json({ error: "One or more selected services do not exist." }, { status: 400 });
    return NextResponse.json({ provider: provider.provider });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Provider details changed at the same time. Refresh and try again." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await lockProvider(tx, id);
      if (!locked.length) return null;
      const provider = await tx.provider.findUnique({ where: { id }, select: { id: true, user: { select: { id: true } }, _count: { select: { appointments: true } } } });
      if (!provider) return null;
      if (provider._count.appointments > 0) {
        await tx.provider.update({ where: { id }, data: { isActive: false } });
        await tx.workingHours.deleteMany({ where: { providerId: id } });
        return { deactivated: true };
      }
      await tx.provider.delete({ where: { id } });
      await tx.user.delete({ where: { id: provider.user.id } });
      return { deactivated: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!result) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    return NextResponse.json({ success: true, deactivated: result.deactivated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Provider changed at the same time. Refresh and try again." }, { status: 409 });
    throw error;
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const { id } = await params;
  const body = await readJson(request); if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  if (typeof input.isActive !== "boolean") return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
  const isActive = input.isActive;
  try {
    const provider = await prisma.$transaction(async (tx) => {
      const locked = await lockProvider(tx, id);
      if (!locked.length) return null;
      const updated = await tx.provider.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } });
      if (!isActive) await tx.workingHours.deleteMany({ where: { providerId: id } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!provider) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Provider changed at the same time. Refresh and try again." }, { status: 409 });
    throw error;
  }
}
