import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ScheduleEditor } from "@/components/schedule-editor";

export default async function ProviderSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await prisma.provider.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      workingHours: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      timeOff: { orderBy: { startsAt: "asc" } },
    },
  });
  if (!provider) notFound();
  return (
    <ScheduleEditor
      provider={{
        id: provider.id,
        name: provider.user.name,
        workingHours: provider.workingHours,
        timeOff: provider.timeOff,
      }}
      timezone={process.env.BUSINESS_TIMEZONE || "Asia/Manila"}
    />
  );
}
