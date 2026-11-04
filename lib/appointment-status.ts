export type AppointmentState = "BOOKED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

const transitions: Record<AppointmentState, readonly AppointmentState[]> = {
  BOOKED: ["CANCELLED", "COMPLETED", "NO_SHOW"],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
};

export function canTransitionAppointment(current: AppointmentState, next: AppointmentState): boolean {
  return transitions[current].includes(next);
}

export function isWithinCancellationWindow(startsAt: Date, now: Date, cancellationWindowHours: number): boolean {
  return startsAt.getTime() - now.getTime() <= cancellationWindowHours * 60 * 60 * 1000;
}

export function getCancellationWindowHours(value = process.env.CANCELLATION_WINDOW_HOURS): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 24;
}

export type CancellationDecisionInput = { role: "CUSTOMER" | "STAFF" | "ADMIN"; ownerMatches: boolean; status: AppointmentState; startsAt: Date; now: Date; cancellationWindowHours: number };
export type Decision = { allowed: true } | { allowed: false; status: 403 | 404 | 409; message: string };

export function decideCancellation(input: CancellationDecisionInput): Decision {
  if (input.role === "STAFF") return { allowed: false, status: 403, message: "You cannot cancel appointments." };
  if (input.role === "CUSTOMER" && !input.ownerMatches) return { allowed: false, status: 404, message: "Appointment not found." };
  if (!canTransitionAppointment(input.status, "CANCELLED")) return { allowed: false, status: 409, message: "Only booked appointments can be cancelled." };
  if (input.role === "CUSTOMER" && isWithinCancellationWindow(input.startsAt, input.now, input.cancellationWindowHours)) {
    return { allowed: false, status: 409, message: `Appointments can only be cancelled more than ${input.cancellationWindowHours} hours before they start.` };
  }
  return { allowed: true };
}

export function decideStatusUpdate(input: { current: AppointmentState; next: AppointmentState; role: "STAFF" | "ADMIN"; ownsProvider: boolean; startsAt: Date; now: Date }): Decision {
  if (input.role === "STAFF" && !input.ownsProvider) return { allowed: false, status: 404, message: "Appointment not found." };
  if (!canTransitionAppointment(input.current, input.next)) return { allowed: false, status: 409, message: "Only booked appointments can be updated." };
  if (input.role === "STAFF" && input.startsAt.getTime() > input.now.getTime()) return { allowed: false, status: 409, message: "Providers can update status only after the appointment starts." };
  return { allowed: true };
}
