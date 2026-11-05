import { compare } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma";
import { createAdminAccount } from "./create-admin";

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  passwordHash: string;
};

function makePrismaStub(initialUsers: StoredUser[] = []) {
  const users = structuredClone(initialUsers);
  const findUnique = vi.fn(async ({ where: { email } }: { where: { email: string }; select: { id: true } }) => {
    const user = users.find((item) => item.email === email);
    return user ? { id: user.id } : null;
  });
  const create = vi.fn(async ({ data }: { data: Omit<StoredUser, "id"> }) => {
    const user = { id: `user-${users.length + 1}`, ...data };
    users.push(user);
    return user;
  });
  return {
    users,
    prisma: { user: { findUnique, create } } as unknown as Pick<PrismaClient, "user">,
    findUnique,
    create,
  };
}

describe("createAdminAccount", () => {
  it("creates a normalized Admin with a bcrypt password hash", async () => {
    const stub = makePrismaStub();
    const result = await createAdminAccount(stub.prisma, {
      name: " Clinic Admin ",
      email: "  ADMIN@EXAMPLE.COM ",
      password: "strong-password-12",
    });

    expect(result).toEqual({ created: true });
    expect(stub.users).toHaveLength(1);
    expect(stub.users[0]).toMatchObject({
      name: "Clinic Admin",
      email: "admin@example.com",
      role: "ADMIN",
    });
    expect(stub.users[0]!.passwordHash).not.toBe("strong-password-12");
    await expect(compare("strong-password-12", stub.users[0]!.passwordHash)).resolves.toBe(true);
  });

  it("does not update an existing account on repeated calls or alter other roles", async () => {
    const originalHash = "pre-existing-hash";
    const staffHash = "staff-hash";
    const customerHash = "customer-hash";
    const stub = makePrismaStub([
      { id: "admin-1", name: "Original Admin", email: "admin@example.com", role: "ADMIN", passwordHash: originalHash },
      { id: "staff-1", name: "Staff", email: "staff@example.com", role: "STAFF", passwordHash: staffHash },
      { id: "customer-1", name: "Customer", email: "customer@example.com", role: "CUSTOMER", passwordHash: customerHash },
    ]);
    const before = structuredClone(stub.users);

    const result = await createAdminAccount(stub.prisma, {
      name: "Replacement Admin",
      email: "ADMIN@example.com",
      password: "different-password-12",
    });

    expect(result).toEqual({ created: false });
    expect(stub.create).not.toHaveBeenCalled();
    expect(stub.users).toEqual(before);
    expect(stub.users.find((user) => user.id === "admin-1")?.passwordHash).toBe(originalHash);
    expect(stub.users.find((user) => user.id === "staff-1")?.passwordHash).toBe(staffHash);
    expect(stub.users.find((user) => user.id === "customer-1")?.passwordHash).toBe(customerHash);
  });

  it("rejects missing or invalid account details before querying the database", async () => {
    const stub = makePrismaStub();
    await expect(createAdminAccount(stub.prisma, { name: "", email: "bad", password: "short" })).rejects.toThrow();
    expect(stub.findUnique).not.toHaveBeenCalled();
    expect(stub.create).not.toHaveBeenCalled();
  });
});
