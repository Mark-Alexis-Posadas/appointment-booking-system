import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    provider: { findMany: vi.fn() },
    service: { update: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) },
    requireAdminApi: vi.fn(async () => ({ ok: true, session: {} })),
    readJson: vi.fn(async (request: Request) => ({ ok: true, data: await request.json() as unknown })),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/admin-api", () => ({ requireAdminApi: mocks.requireAdminApi, readJson: mocks.readJson }));

describe("admin service mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.provider.findMany.mockResolvedValue([{ id: "provider-b" }, { id: "provider-a" }]);
    mocks.tx.$queryRaw.mockImplementation(async (query: { sql?: string; values?: unknown[] }) => {
      if (query.sql?.includes('"Service"')) return [{ id: "service-1" }];
      return [{ id: "provider-a" }, { id: "provider-b" }];
    });
    mocks.tx.service.update.mockResolvedValue({ id: "service-1", isActive: false, durationMinutes: 60 });
    mocks.tx.service.findUnique.mockResolvedValue({ _count: { appointments: 0 } });
    mocks.tx.service.delete.mockResolvedValue({ id: "service-1" });
  });

  it("locks associated providers in sorted order before changing service availability", async () => {
    const { PATCH } = await import("@/app/api/admin/services/route");
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ id: "service-1", name: "Consultation", durationMinutes: 60, price: "25.00", isActive: false }) }));
    expect(response.status).toBe(200);
    const lockQueries = mocks.tx.$queryRaw.mock.calls.map(([query]) => query as { sql?: string; values?: unknown[] });
    expect(lockQueries).toHaveLength(2);
    expect(lockQueries[0]?.sql).toContain('"Provider"');
    expect(lockQueries[0]?.values).toEqual(["provider-a", "provider-b"]);
    expect(lockQueries[1]?.sql).toContain('"Service"');
    expect(mocks.tx.service.update).toHaveBeenCalledOnce();
  });

  it("returns conflict for a serialization failure without applying the service update", async () => {
    mocks.tx.$queryRaw.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("serialization failure", { code: "P2034", clientVersion: "test" }));
    const { PATCH } = await import("@/app/api/admin/services/route");
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ id: "service-1", name: "Consultation", durationMinutes: 60, price: "25.00", isActive: false }) }));
    expect(response.status).toBe(409);
    expect(mocks.tx.service.update).not.toHaveBeenCalled();
  });

  it("preserves the booked-appointment deletion restriction", async () => {
    mocks.tx.service.findUnique.mockResolvedValue({ _count: { appointments: 2 } });
    const { DELETE } = await import("@/app/api/admin/services/route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE", body: JSON.stringify({ id: "service-1" }) }));
    expect(response.status).toBe(409);
    expect(mocks.tx.service.delete).not.toHaveBeenCalled();
  });

  it("deletes an unused service after locking providers and service row", async () => {
    const { DELETE } = await import("@/app/api/admin/services/route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE", body: JSON.stringify({ id: "service-1" }) }));
    expect(response.status).toBe(200);
    expect(mocks.tx.service.delete).toHaveBeenCalledOnce();
  });
});
