# Appointment Booking System

Clinic or salon appointment booking app built with Next.js App Router, PostgreSQL/Prisma, and Auth.js credentials. It includes project setup and authentication, admin management, availability lookup, customer booking and appointment management, and a provider dashboard. Emails and visual redesign are not included.

## Requirements

- Node.js 20 or newer and npm
- PostgreSQL 14 or newer

## Setup

1. Install packages:

   ```bash
   npm install
   ```

2. Create a local PostgreSQL database named `appointment_booking` (or use another database name).

3. Copy `.env.example` to `.env` and set `DATABASE_URL`, `AUTH_SECRET`, and the seed admin values. Generate a secret with `npx auth secret`. `BUSINESS_TIMEZONE` defaults to `Asia/Manila`; weekly working-hour strings are interpreted in that timezone and time-off dates entered in the admin panel are converted to UTC instants. Keep `.env` private; it is ignored by Git.

4. Create and apply the initial migration, then generate the Prisma client:

   ```bash
   npx prisma migrate dev
   npm run db:generate
   ```

5. Seed the local database:

   ```bash
   npm run db:seed
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Authentication checks

- **Registration:** Open `/register`, submit a name, email, and password of at least 8 characters. Successful registration redirects to login; a duplicate email returns a conflict message. `POST /api/register` accepts JSON and returns only `id`, `name`, `email`, `role`, and `createdAt`.
- **Login:** Sign in at `/login` with a registered account. The seeded administrator credentials are the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` values from your local `.env`.
- **Session and logout:** `/dashboard` shows the authenticated name and role. Its logout button ends the session.
- **Protection:** While signed out, visiting `/dashboard` redirects to login and retains the requested path. To exercise role checks from a server page or route handler, use `await requireRole("ADMIN")` from `lib/authz`; a signed-in user with another role is redirected away. Role assignment is controlled by trusted seed/admin code, never by public registration.

## Admin panel

- Visit `/admin` after signing in with the seeded administrator account. Middleware and the admin layout both enforce `ADMIN`; every admin REST route independently returns 401 when logged out and 403 for non-admin users.
- Use `/admin/services` to create, edit, activate/deactivate, or delete services. A service with appointments cannot be deleted.
- Use `/admin/providers` to create staff users and provider records, edit names and bios, assign services, and deactivate providers. Provider creation is transactional.
- Open a provider schedule to maintain multiple weekly time ranges and time-off periods. Weekly hours use local `HH:mm` strings in `BUSINESS_TIMEZONE`; time off is stored as UTC timestamps. Overlapping booked appointments produce a warning and do not prevent adding time off.
- Visit `/book` to select a service, provider, date, and available time. Booking requires a CUSTOMER account. Login and registration return the customer to the selected time for confirmation.
- Successful bookings redirect to `/book/confirmation/:id`. Only the appointment owner or an ADMIN can view that page; other users receive a 404.

## Environment variables

`.env.example` documents all variables used by the application and seed script:

- `DATABASE_URL`: PostgreSQL connection string.
- `AUTH_SECRET`: secret used to sign Auth.js session tokens.
- `AUTH_URL`: base URL of the application.
- `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`: development seed administrator credentials. Seeding also creates a sample `provider@example.com` staff profile with a random unusable password.
- `BUSINESS_TIMEZONE`: IANA timezone for weekly working hours and local time-off form entry; defaults to `Asia/Manila`.
- `SLOT_INTERVAL_MINUTES`: availability start-time interval in minutes; defaults to `15`.
- `MIN_NOTICE_HOURS`: minimum lead time before a slot; defaults to `2`.
- `MAX_ADVANCE_DAYS`: maximum number of days ahead for a slot; defaults to `60`.
- `CANCELLATION_WINDOW_HOURS`: minimum notice for customer cancellation and rescheduling; defaults to `24`. Admin cancellation bypasses this window.

## Availability engine

The public read-only endpoint `GET /api/providers/:id/slots?date=YYYY-MM-DD&serviceId=...` returns `{ slots: [{ startsAt, endsAt }], businessTimezone }`. Slot timestamps are UTC ISO strings. Convert them for display using the returned IANA timezone. The endpoint does not expose customer or appointment data and uses a simple per-process rate limit. `POST /api/appointments` requires a signed-in CUSTOMER, rechecks availability inside a transaction, and is rate limited per user.

The pure `getAvailableSlots` function in `lib/availability.ts` receives all working hours, time-off, appointments, current time, and configuration as inputs. It performs no database access, so it can be tested independently:

```bash
npm test
```

The loader in `lib/availability-data.ts` fetches only the selected provider/service, that weekday's working hours, and time-off/booked appointments overlapping the local day's UTC range.

## Booking overlap protection

Migration `20261103120000_appointment_overlap_guard` installs PostgreSQL's `btree_gist` extension, removes the old `(providerId, startsAt)` unique index, and adds a partial GiST exclusion constraint on each provider's `[startsAt, endsAt)` range for `BOOKED` appointments. The half-open range allows back-to-back appointments, while the exclusion constraint prevents overlapping appointments even when concurrent requests race. Cancelled appointments are excluded, so their times can be booked again. The migration can fail if the database already contains overlapping BOOKED appointments; resolve those conflicts before applying it.

The booking transaction also locks the customer row and checks for any overlapping BOOKED appointment by that customer across providers. Provider overlap is enforced at the database level.

## Appointment management

- Customers use `/appointments` to review upcoming and past/cancelled appointments, cancel, and reschedule. Cancellation and rescheduling must happen more than `CANCELLATION_WINDOW_HOURS` before the appointment starts.
- Staff use `/provider` for their own day, week, and list calendar. Only their provider's appointment feed is queried; staff can mark an appointment COMPLETED or NO_SHOW after it starts.
- Admins use `/admin/appointments` for server-paginated (20 per page) booking search and filters. Admin cancellation has no cancellation-window restriction.
- Status changes use the shared transition helper in `lib/appointment-status.ts`: BOOKED can transition to CANCELLED, COMPLETED, or NO_SHOW; final states cannot transition again.
- API timestamps remain UTC. Customer cards, the provider calendar, and admin views display appointment times in `BUSINESS_TIMEZONE`.

Run the automated unit and mocked-transaction tests with:

```bash
npm test
```

The booking-logic tests use an in-memory mocked transaction repository, not a separate PostgreSQL test database. The concurrency test simulates two simultaneous requests competing for one slot.

The Step 2 migration adds `Provider.isActive`, which allows staff profiles to be deactivated while preserving appointment history. Apply it with `npx prisma migrate dev` before running the updated seed or app.

All appointment and time-off datetimes use PostgreSQL `TIMESTAMPTZ` and should be supplied as UTC instants. Working-hours `startTime` and `endTime` are local wall-clock times in `HH:mm` form; provider timezone support can be added when scheduling behavior is introduced.
