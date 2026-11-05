import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import { Prisma, PrismaClient, Role } from "../../generated/prisma";
import { z } from "zod";

const resetInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

type ResetInput = { email: string; password: string };

export class StaffPasswordResetError extends Error {
  constructor(
    readonly code: "STAFF_ACCOUNT_NOT_FOUND" | "ROLE_NOT_ALLOWED" | "STAFF_ROLE_CHANGED",
    message: string,
  ) {
    super(message);
    this.name = "StaffPasswordResetError";
  }
}

export function safeResetErrorMessage(error: unknown): string {
  if (error instanceof StaffPasswordResetError) return error.message;
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return `Prisma database initialization failed${error.errorCode ? ` (${error.errorCode})` : ""}. Check database connectivity and configuration.`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `Prisma database request failed (${error.code}). No password or account data was logged.`;
  }
  if (error instanceof Error) {
    return `Staff password reset failed (${error.name}). Check the reset input and database configuration.`;
  }
  return "Staff password reset failed due to an unknown error.";
}

export async function resetStaffPassword(
  prisma: Pick<PrismaClient, "user">,
  input: ResetInput,
): Promise<void> {
  const parsed = resetInputSchema.safeParse({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid reset details.");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true },
  });
  if (!user) {
    throw new StaffPasswordResetError("STAFF_ACCOUNT_NOT_FOUND", "No account exists for RESET_STAFF_EMAIL in the connected database.");
  }
  if (user.role !== Role.STAFF) {
    throw new StaffPasswordResetError("ROLE_NOT_ALLOWED", "The account is not STAFF; no account data was changed.");
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const result = await prisma.user.updateMany({
    where: { id: user.id, role: Role.STAFF },
    data: { passwordHash },
  });
  if (result.count !== 1) {
    throw new StaffPasswordResetError("STAFF_ROLE_CHANGED", "The account is no longer STAFF; password was not changed.");
  }
}

async function main() {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const parsed = resetInputSchema.safeParse({
    email: process.env.RESET_STAFF_EMAIL?.trim().toLowerCase(),
    password: process.env.RESET_STAFF_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(
      `Staff reset details are missing or invalid: ${parsed.error.issues[0]?.message ?? "check required values"}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    await resetStaffPassword(prisma, parsed.data);
    console.info(`Password updated for staff account ${parsed.data.email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(safeResetErrorMessage(error));
    process.exitCode = 1;
  });
}
