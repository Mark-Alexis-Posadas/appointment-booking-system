import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    provider: { update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    workingHours: { deleteMany: vi.fn() },
    user: { delete: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)), service: { findMany: vi.fn() } },
    requireAdminApi: vi.fn(async () => ({ ok: true, session: {} })),
    readJson: vi.fn(async (request: Request) => ({ ok: true, data: await request.json() as unknown })),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: stubs.prisma }));
vi.mock("@/lib/admin-api", () => ({ requireAdminApi: stubs.requireAdminApi, readJson: stubs.readJson }));

describe("admin provider availability mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubs.tx.$queryRaw.mockImplementation(async (query: { sql?: string }) => query.sql?.includes('"Service"') ? [{ id: "clxxxxxxxxxxxxxxxxxxxxxxxx" }] : [{ id: "provider-1" }]);
    stubs.prisma.service.findMany.mockResolvedValue([{ id: "clxxxxxxxxxxxxxxxxxxxxxxxx" }]);
    stubs.tx.provider.update.mockResolvedValue({ id: "provider-1", isActive: false });
    stubs.tx.provider.findUnique.mockResolvedValue({ id: "provider-1", user: { id: "user-1" }, _count: { appointments: 1 } });
    stubs.tx.workingHours.deleteMany.mockResolvedValue({ count: 2 });
  });

  it("locks the provider before changing service assignments", async () => {
    const { PUT } = await import("@/app/api/admin/providers/[id]/route");
    const response = await PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify({ name: "Provider One", bio: null, serviceIds: ["clxxxxxxxxxxxxxxxxxxxxxxxx"] }) }), { params: Promise.resolve({ id: "provider-1" }) });
    expect(response.status).toBe(200);
    expect(stubs.tx.$queryRaw).toHaveBeenCalledTimes(2);
    const lockQueries = stubs.tx.$queryRaw.mock.calls.map(([query]) => query as { sql?: string });
    expect(lockQueries[0]?.sql).toContain('"Provider"');
    expect(lockQueries[1]?.sql).toContain('"Service"');
    expect(stubs.tx.provider.update).toHaveBeenCalledOnce();
    expect(stubs.prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("makes deactivation and working-hours deletion one locked transaction", async () => {
    const { PATCH } = await import("@/app/api/admin/providers/[id]/route");
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ isActive: false }) }), { params: Promise.resolve({ id: "provider-1" }) });
    expect(response.status).toBe(200);
    expect(stubs.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(stubs.tx.provider.update).toHaveBeenCalledOnce();
    expect(stubs.tx.workingHours.deleteMany).toHaveBeenCalledOnce();
  });

  it("locks before provider deletion/deactivation and removes hours atomically", async () => {
    const { DELETE } = await import("@/app/api/admin/providers/[id]/route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: "provider-1" }) });
    expect(response.status).toBe(200);
    expect(stubs.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(stubs.tx.provider.update).toHaveBeenCalledWith({ where: { id: "provider-1" }, data: { isActive: false } });
    expect(stubs.tx.workingHours.deleteMany).toHaveBeenCalledOnce();
  });
});
