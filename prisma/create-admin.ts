import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import { Prisma, PrismaClient, Role } from "../generated/prisma";
import { registrationSchema } from "../lib/schemas";

type AdminInput = { name: string; email: string; password: string };
type AdminCreateResult = { created: true } | { created: false };

export async function createAdminAccount(
  prisma: Pick<PrismaClient, "user">,
  input: AdminInput,
): Promise<AdminCreateResult> {
  const parsed = registrationSchema.safeParse({
    ...input,
    email: input.email.trim().toLowerCase(),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid admin account details.");
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return { created: false };

  const passwordHash = await hash(password, 12);
  try {
    await prisma.user.create({
      data: { name, email, passwordHash, role: Role.ADMIN },
    });
    return { created: true };
  } catch (error) {
    // Another invocation may create this email after the existence check.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("email")
    ) {
      return { created: false };
    }
    throw error;
  }
}

async function main() {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const parsed = registrationSchema.safeParse({
    name: process.env.CREATE_ADMIN_NAME,
    email: process.env.CREATE_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.CREATE_ADMIN_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(
      `Admin details are missing or invalid: ${parsed.error.issues[0]?.message ?? "check required values"}`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const result = await createAdminAccount(prisma, parsed.data);
    console.info(
      result.created
        ? `Admin account created for ${parsed.data.email}.`
        : `An account for ${parsed.data.email} already exists; no account data was changed.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("Admin account creation failed. Check the supplied values and database connection.");
    process.exitCode = 1;
  });
}
