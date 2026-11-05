import { compare } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "../../generated/prisma";
import { resetStaffPassword, safeResetErrorMessage } from "./reset-passwords";

type UserRecord = { id: string; email: string; role: "ADMIN" | "STAFF" | "CUSTOMER"; passwordHash: string };

function makePrismaStub(user: UserRecord | null) {
  const findUnique = vi.fn(async () => user ? { id: user.id, role: user.role } : null);
  const updateMany = vi.fn(async ({ data }: { where: { id: string; role: string }; data: { passwordHash: string } }) => {
    if (!user || user.id !== "staff-1" || user.role !== "STAFF") return { count: 0 };
    user.passwordHash = data.passwordHash;
    return { count: 1 };
  });
  return {
    prisma: { user: { findUnique, updateMany } } as unknown as Pick<PrismaClient, "user">,
    findUnique,
    updateMany,
  };
}

describe("resetStaffPassword", () => {
  it("updates only the password hash for a STAFF account", async () => {
    const staff: UserRecord = { id: "staff-1", email: "staff@example.com", role: "STAFF", passwordHash: "old-hash" };
    const originalAccount = structuredClone(staff);
    const stub = makePrismaStub(staff);

    await resetStaffPassword(stub.prisma, { email: " STAFF@EXAMPLE.COM ", password: "new-password-123" });

    expect(stub.findUnique).toHaveBeenCalledWith({
      where: { email: "staff@example.com" },
      select: { id: true, role: true },
    });
    expect(stub.updateMany).toHaveBeenCalledWith({
      where: { id: "staff-1", role: "STAFF" },
      data: { passwordHash: expect.any(String) },
    });
    expect(staff).toMatchObject({
      ...originalAccount,
      passwordHash: expect.stringMatching(/^\$2[aby]\$12\$/),
    });
    expect(staff.role).toBe("STAFF");
    expect(staff.passwordHash).not.toBe("new-password-123");
    await expect(compare("new-password-123", staff.passwordHash)).resolves.toBe(true);
  });

  it.each([
    ["ADMIN", "admin-1"],
    ["CUSTOMER", "customer-1"],
  ] as const)("rejects %s accounts without updating them", async (role, id) => {
    const user: UserRecord = { id, email: `${role.toLowerCase()}@example.com`, role, passwordHash: "unchanged-hash" };
    const stub = makePrismaStub(user);

    await expect(resetStaffPassword(stub.prisma, { email: user.email, password: "new-password-123" }))
      .rejects.toThrow("The account is not STAFF; no account data was changed.");

    expect(stub.updateMany).not.toHaveBeenCalled();
    expect(user).toEqual({ id, email: user.email, role, passwordHash: "unchanged-hash" });
  });

  it("does not create an account when the email is unknown", async () => {
    const stub = makePrismaStub(null);

    await expect(resetStaffPassword(stub.prisma, { email: "missing@example.com", password: "new-password-123" }))
      .rejects.toThrow("No account exists for RESET_STAFF_EMAIL in the connected database.");

    expect(stub.updateMany).not.toHaveBeenCalled();
  });

  it("reports a safe diagnostic for a database error without exposing its message", () => {
    const error = new Error("connection failed; secret=do-not-print");
    expect(safeResetErrorMessage(error)).toContain("Staff password reset failed (Error)");
    expect(safeResetErrorMessage(error)).not.toContain("do-not-print");
  });

  it("reports Prisma connectivity codes without printing connection details", () => {
    const error = new Prisma.PrismaClientInitializationError(
      "failed for postgresql://user:secret@db.example.test/app",
      "test",
      "P1001",
    );
    const message = safeResetErrorMessage(error);

    expect(message).toContain("P1001");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("db.example.test");
  });
});
