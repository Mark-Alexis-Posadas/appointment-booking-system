import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { serviceSchema } from "@/lib/schemas";
import { lockProviderRows, lockServiceRows } from "@/lib/prisma-booking";

export async function GET() {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const services = await prisma.service.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { appointments: true } } } });
  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsed = serviceSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid service details.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  const service = await prisma.service.create({ data: parsed.data });
  return NextResponse.json({ service }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await readJson(request); if (!body.ok) return body.response;
  const parsedBody = body.data as Record<string, unknown>;
  const id = typeof parsedBody.id === "string" ? parsedBody.id : "";
  const parsed = serviceSchema.safeParse(parsedBody);
  if (!id || !parsed.success) return NextResponse.json({ error: "Invalid service details.", details: parsed.success ? undefined : parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const providers = await tx.provider.findMany({ where: { services: { some: { id } } }, select: { id: true }, orderBy: { id: "asc" } });
      const lockedProviders = await lockProviderRows(tx, providers.map(({ id: providerId }) => providerId));
      if (lockedProviders.length !== providers.length) return { kind: "conflict" as const };
      const lockedServices = await lockServiceRows(tx, [id]);
      if (!lockedServices.length) return { kind: "not-found" as const };
      const service = await tx.service.update({ where: { id }, data: parsed.data });
      return { kind: "updated" as const, service };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Service not found." }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Provider availability changed at the same time. Refresh and try again." }, { status: 409 });
    const { service } = result;
    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Service not found." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Provider availability changed at the same time. Refresh and try again." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await readJson(request); if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const providers = await tx.provider.findMany({ where: { services: { some: { id } } }, select: { id: true }, orderBy: { id: "asc" } });
      const lockedProviders = await lockProviderRows(tx, providers.map(({ id: providerId }) => providerId));
      if (lockedProviders.length !== providers.length) return { kind: "conflict" as const };
      const lockedServices = await lockServiceRows(tx, [id]);
      if (!lockedServices.length) return { kind: "not-found" as const };
      const service = await tx.service.findUnique({ where: { id }, select: { _count: { select: { appointments: true } } } });
      if (!service) return { kind: "not-found" as const };
      if (service._count.appointments > 0) return { kind: "has-appointments" as const };
      await tx.service.delete({ where: { id } });
      return { kind: "deleted" as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.kind === "not-found") return NextResponse.json({ error: "Service not found." }, { status: 404 });
    if (result.kind === "conflict") return NextResponse.json({ error: "Provider availability changed at the same time. Refresh and try again." }, { status: 409 });
    if (result.kind === "has-appointments") return NextResponse.json({ error: "This service has appointments and cannot be deleted. Deactivate it instead." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Provider availability changed at the same time. Refresh and try again." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Service not found." }, { status: 404 });
    throw error;
  }
}
