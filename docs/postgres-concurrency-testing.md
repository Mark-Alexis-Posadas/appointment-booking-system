# PostgreSQL concurrency test setup

The repository does not currently contain a real-PostgreSQL concurrency test suite. The unit tests use mocked transactions and must not be treated as concurrency verification.

## Prepare an isolated database

1. Create a dedicated, disposable PostgreSQL database named `appointment_booking_test` using a local PostgreSQL administrator account. Do not reuse the database in `.env`.
2. Copy `.env.test.example` to a private local test env file and set its `DATABASE_URL` to that database. Keep credentials out of Git.
3. In a fresh PowerShell session, set the process-scoped `DATABASE_URL` to the test database URL before running Prisma commands. Confirm the database name is `appointment_booking_test` before continuing.
4. Apply the existing migrations with `npx prisma migrate deploy`. This command must only run against that disposable test database.
5. Run the future PostgreSQL integration suite with independent Prisma clients/connections and controlled synchronization barriers. Do not rely on sleep-only timing.

The current Vitest suite does not implement those database scenarios yet. Required cases are simultaneous overlapping bookings; booking against provider deactivation, schedule edits, time off, cancellation, and deletion; service activation/duration/deletion against booking; provider assignment against service mutation; and rollback/serialization behavior. Assert both returned outcomes and final database state.

Because the Prisma schema reads `DATABASE_URL`, the test process must explicitly override that variable. Do not run migration or integration commands until the target is the dedicated disposable database.
