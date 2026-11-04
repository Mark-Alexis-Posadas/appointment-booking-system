import { z } from "zod";

export const registrationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

const moneySchema = z.union([z.number(), z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Enter a valid price.").transform(Number)]).refine(Number.isFinite, "Enter a valid price.");
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm time.");

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: moneySchema.refine((value) => value >= 0, "Price cannot be negative.").transform((value) => value.toFixed(2)),
  isActive: z.boolean().default(true),
});

export const providerCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  temporaryPassword: z.string().min(8).max(128),
  bio: z.string().trim().max(2000).nullable().optional(),
  serviceIds: z.array(z.cuid()).default([]),
});

export const providerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(2000).nullable().optional(),
  serviceIds: z.array(z.cuid()),
});

export const scheduleSchema = z.object({
  days: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    ranges: z.array(z.object({ startTime: timeSchema, endTime: timeSchema })).max(12),
  })).length(7),
}).superRefine(({ days }, context) => {
  if (new Set(days.map((day) => day.weekday)).size !== 7) context.addIssue({ code: "custom", message: "Each weekday must appear once." });
  for (const day of days) {
    const ranges = day.ranges.map((range) => ({ ...range, start: range.startTime.replace(":", ""), end: range.endTime.replace(":", "") })).sort((a, b) => a.start.localeCompare(b.start));
    for (const [index, range] of ranges.entries()) {
      if (range.end <= range.start) context.addIssue({ code: "custom", path: ["days", day.weekday, "ranges", index], message: "End time must be after start time." });
      if (index > 0 && range.start < ranges[index - 1]!.end) context.addIssue({ code: "custom", path: ["days", day.weekday, "ranges", index], message: "Time ranges on the same day cannot overlap." });
    }
  }
});

export const timeOffSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(500).nullable().optional(),
}).refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ["endsAt"], message: "End must be after start." });

export const providerSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD.").refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year!, month! - 1, day!));
    return parsed.toISOString().slice(0, 10) === value;
  }, "Date must be a real calendar date."),
  serviceId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, "Invalid service id."),
});

export const createAppointmentSchema = z.object({
  providerId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  serviceId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  startsAt: z.iso.datetime({ offset: false }),
});

export const rescheduleAppointmentSchema = z.object({ startsAt: z.iso.datetime({ offset: false }) });
export const appointmentStatusUpdateSchema = z.object({ status: z.enum(["COMPLETED", "NO_SHOW"]) });
