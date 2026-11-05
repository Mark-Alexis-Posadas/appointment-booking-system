import { DateTime } from "luxon";
import {
  getAvailableSlots,
  type AppointmentInput,
  type AvailabilityConfig,
  type TimedIntervalInput,
  type WorkingHourInput,
} from "@/lib/availability";
import {
  canTransitionAppointment,
  isWithinCancellationWindow,
  type AppointmentState,
} from "@/lib/appointment-status";
import { Prisma } from "@/generated/prisma";

const PROVIDER_OVERLAP_CONSTRAINT = "Appointment_provider_no_booked_overlap";

export function isProviderOverlapConstraintError(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2004"
  )
    return false;
  const meta = error.meta ?? {};
  const serialized = JSON.stringify(meta);
  return (
    serialized.includes("23P01") ||
    serialized.includes(PROVIDER_OVERLAP_CONSTRAINT)
  );
}

export type BookingService = {
  providerId: string;
  providerName: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  servicePrice: string;
};

export type CreatedAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentState;
  provider: { name: string };
  service: { name: string; price: string };
};

export type ReschedulableAppointment = {
  id: string;
  customerId: string;
  providerId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentState;
};

export interface BookingTransaction {
  /** Lock provider rows in sorted order, then customer row, then appointment rows. */
  lockProviders(providerIds: string[]): Promise<boolean>;
  lockCustomer(customerId: string): Promise<boolean>;
  getActiveProviderService(
    providerId: string,
    serviceId: string,
  ): Promise<BookingService | null>;
  getWorkingHours(
    providerId: string,
    weekday: number,
  ): Promise<WorkingHourInput[]>;
  getTimeOff(
    providerId: string,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<TimedIntervalInput[]>;
  getBookedAppointments(
    providerId: string,
    dayStart: Date,
    dayEnd: Date,
    excludeAppointmentId?: string,
  ): Promise<AppointmentInput[]>;
  hasCustomerOverlap(
    customerId: string,
    startsAt: Date,
    endsAt: Date,
    excludeAppointmentId?: string,
  ): Promise<boolean>;
  createAppointment(
    customerId: string,
    providerId: string,
    serviceId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<CreatedAppointment>;
  getOwnedAppointmentForUpdate?(
    appointmentId: string,
    customerId: string,
    lock?: boolean,
  ): Promise<ReschedulableAppointment | null>;
  updateAppointmentTime?(
    appointmentId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<CreatedAppointment>;
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 409,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type CreateBookingInput = {
  customerId: string;
  providerId: string;
  serviceId: string;
  startsAt: string;
};
export type BookingExecutor = <T>(
  operation: (transaction: BookingTransaction) => Promise<T>,
) => Promise<T>;

function requestedSlot(value: string, timezone: string) {
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid || !value.endsWith("Z"))
    throw new BookingError("startsAt must be a UTC ISO timestamp.", 400);
  const local = parsed.setZone(timezone);
  if (!local.isValid || !local.toISODate())
    throw new BookingError("Invalid booking date or business timezone.", 400);
  return {
    startsAt: parsed.toUTC().toJSDate(),
    local,
    date: local.toISODate()!,
  };
}

async function verifySlot(
  transaction: BookingTransaction,
  input: {
    providerId: string;
    serviceId: string;
    startsAt: Date;
    date: string;
    local: DateTime;
    config: AvailabilityConfig;
    now: Date;
    excludeAppointmentId?: string;
  },
) {
  const providerService = await transaction.getActiveProviderService(
    input.providerId,
    input.serviceId,
  );
  if (!providerService)
    throw new BookingError("Provider or service is unavailable.", 404);
  const dayStart = input.local.startOf("day").toUTC().toJSDate();
  const dayEnd = input.local
    .plus({ days: 1 })
    .startOf("day")
    .toUTC()
    .toJSDate();
  const [workingHours, timeOff, appointments] = await Promise.all([
    transaction.getWorkingHours(input.providerId, input.local.weekday % 7),
    transaction.getTimeOff(input.providerId, dayStart, dayEnd),
    transaction.getBookedAppointments(
      input.providerId,
      dayStart,
      dayEnd,
      input.excludeAppointmentId,
    ),
  ]);
  const available = getAvailableSlots({
    date: input.date,
    serviceDurationMinutes: providerService.serviceDurationMinutes,
    workingHours,
    timeOff,
    appointments,
    now: input.now,
    config: input.config,
  });
  const slot = available.find(
    (candidate) => Date.parse(candidate.startsAt) === input.startsAt.getTime(),
  );
  if (!slot) throw new BookingError("That slot is no longer available.", 409);
  return {
    providerService,
    endsAt: new Date(
      input.startsAt.getTime() +
        providerService.serviceDurationMinutes * 60_000,
    ),
  };
}

export async function createBooking(
  input: CreateBookingInput,
  execute: BookingExecutor,
  config: AvailabilityConfig,
  now: Date = new Date(),
): Promise<CreatedAppointment> {
  const requested = requestedSlot(input.startsAt, config.businessTimezone);

  return execute(async (transaction) => {
    if (!(await transaction.lockProviders([input.providerId])))
      throw new BookingError("Provider or service is unavailable.", 404);
    if (!(await transaction.lockCustomer(input.customerId)))
      throw new BookingError("Your account is no longer available.", 401);
    const { endsAt } = await verifySlot(transaction, {
      providerId: input.providerId,
      serviceId: input.serviceId,
      startsAt: requested.startsAt,
      date: requested.date,
      local: requested.local,
      config,
      now,
    });
    if (
      await transaction.hasCustomerOverlap(
        input.customerId,
        requested.startsAt,
        endsAt,
      )
    ) {
      throw new BookingError(
        "You already have an overlapping appointment.",
        409,
      );
    }
    return transaction.createAppointment(
      input.customerId,
      input.providerId,
      input.serviceId,
      requested.startsAt,
      endsAt,
    );
  });
}

export async function rescheduleBooking(
  input: { customerId: string; appointmentId: string; startsAt: string },
  execute: BookingExecutor,
  config: AvailabilityConfig,
  cancellationWindowHours: number,
  now: Date = new Date(),
): Promise<CreatedAppointment> {
  const requested = requestedSlot(input.startsAt, config.businessTimezone);
  return execute(async (transaction) => {
    if (
      !transaction.getOwnedAppointmentForUpdate ||
      !transaction.updateAppointmentTime
    )
      throw new Error("Reschedule transaction support is missing.");
    // Read the provider id without a row lock so every mutation uses provider -> customer -> appointment order.
    const target = await transaction.getOwnedAppointmentForUpdate(
      input.appointmentId,
      input.customerId,
      false,
    );
    if (!target) throw new BookingError("Appointment not found.", 404);
    if (!(await transaction.lockProviders([target.providerId])))
      throw new BookingError("Provider or service is unavailable.", 404);
    if (!(await transaction.lockCustomer(input.customerId)))
      throw new BookingError("Your account is no longer available.", 401);
    const appointment = await transaction.getOwnedAppointmentForUpdate(
      input.appointmentId,
      input.customerId,
    );
    if (!appointment) throw new BookingError("Appointment not found.", 404);
    if (!canTransitionAppointment(appointment.status, "CANCELLED"))
      throw new BookingError(
        "Only booked appointments can be rescheduled.",
        409,
      );
    if (
      isWithinCancellationWindow(
        appointment.startsAt,
        now,
        cancellationWindowHours,
      )
    )
      throw new BookingError(
        `Appointments can only be rescheduled more than ${cancellationWindowHours} hours before they start.`,
        409,
      );

    const { endsAt } = await verifySlot(transaction, {
      providerId: appointment.providerId,
      serviceId: appointment.serviceId,
      startsAt: requested.startsAt,
      date: requested.date,
      local: requested.local,
      config,
      now,
      excludeAppointmentId: appointment.id,
    });
    if (
      await transaction.hasCustomerOverlap(
        input.customerId,
        requested.startsAt,
        endsAt,
        appointment.id,
      )
    ) {
      throw new BookingError(
        "You already have an overlapping appointment.",
        409,
      );
    }
    return transaction.updateAppointmentTime(
      appointment.id,
      requested.startsAt,
      endsAt,
    );
  });
}
