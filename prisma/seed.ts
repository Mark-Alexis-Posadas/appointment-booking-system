import { hash } from "bcryptjs";
import { PrismaClient, Role } from "../generated/prisma";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const adminName = process.env.SEED_ADMIN_NAME;
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminName || !adminEmail || !adminPassword) throw new Error("Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD before seeding.");

  const passwordHash = await hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, role: Role.ADMIN, passwordHash },
    create: { name: adminName, email: adminEmail, role: Role.ADMIN, passwordHash },
  });
  const serviceSeeds = [
    { id: "seed-service-consultation", name: "Initial Consultation", durationMinutes: 30, price: "25.00" },
    { id: "seed-service-treatment", name: "Standard Treatment", durationMinutes: 60, price: "60.00" },
    { id: "seed-service-followup", name: "Follow-up Visit", durationMinutes: 20, price: "18.00" },
    { id: "seed-service-premium", name: "Premium Care", durationMinutes: 90, price: "95.00" },
  ];
  const services = await Promise.all(serviceSeeds.map((service) => prisma.service.upsert({ where: { id: service.id }, update: { ...service, isActive: true }, create: service })));
  const providerSeeds = [
    { key: "alex", name: "Alex Santos", email: "alex.provider@example.com", bio: "Consultation and standard care.", serviceIds: [services[0]!.id, services[1]!.id], weekdays: [1, 2, 3, 4, 5], ranges: [["09:00", "12:00"], ["13:00", "17:00"]] },
    { key: "maria", name: "Maria Reyes", email: "maria.provider@example.com", bio: "Follow-up and premium care.", serviceIds: [services[2]!.id, services[3]!.id], weekdays: [1, 2, 4, 5, 6], ranges: [["10:00", "18:00"]] },
  ] as const;
  for (const sample of providerSeeds) {
    const passwordHash = await hash(randomUUID(), 12);
    const providerUser = await prisma.user.upsert({ where: { email: sample.email }, update: { name: sample.name, role: Role.STAFF }, create: { name: sample.name, email: sample.email, role: Role.STAFF, passwordHash } });
    const provider = await prisma.provider.upsert({ where: { userId: providerUser.id }, update: { bio: sample.bio, isActive: true, services: { set: sample.serviceIds.map((id) => ({ id })) } }, create: { userId: providerUser.id, bio: sample.bio, services: { connect: sample.serviceIds.map((id) => ({ id })) } } });
    const existingAppointments = await prisma.appointment.count({ where: { providerId: provider.id } });
    if (existingAppointments === 0) await prisma.workingHours.deleteMany({ where: { providerId: provider.id } });
    const schedule = sample.weekdays.flatMap((weekday) => sample.ranges.map(([startTime, endTime]) => ({ providerId: provider.id, weekday, startTime, endTime })));
    if (schedule.length && existingAppointments === 0) await prisma.workingHours.createMany({ data: schedule });
  }
  console.info(`Seeded admin ${adminEmail}, ${services.length} services, two staff providers, and varied schedules. Timezone: ${process.env.BUSINESS_TIMEZONE || "Asia/Manila"}.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
