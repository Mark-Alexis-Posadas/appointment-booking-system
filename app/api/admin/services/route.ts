import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { readJson, requireAdminApi } from "@/lib/admin-api";
import { serviceSchema } from "@/lib/schemas";

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
    const service = await prisma.service.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Service not found." }, { status: 404 });
    throw error;
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await readJson(request); if (!body.ok) return body.response;
  const input = body.data as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return NextResponse.json({ error: "Service id is required." }, { status: 400 });
  const service = await prisma.service.findUnique({ where: { id }, include: { _count: { select: { appointments: true } } } });
  if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  if (service._count.appointments > 0) return NextResponse.json({ error: "This service has appointments and cannot be deleted. Deactivate it instead." }, { status: 409 });
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
