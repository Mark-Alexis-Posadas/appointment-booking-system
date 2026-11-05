import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

describe("PATCH /api/appointments/[id]/cancel conflict handling", () => {
  it("returns HTTP 409 for Prisma serialization failures", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "customer-1", role: "CUSTOMER" } });
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("serialization failure", { code: "P2034", clientVersion: "test" }));
    const { PATCH } = await import("@/app/api/appointments/[id]/cancel/route");
    const response = await PATCH(new Request("http://localhost", { method: "PATCH" }), { params: Promise.resolve({ id: "appointment-1" }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "The appointment changed at the same time. Refresh and try again." });
  });
});
