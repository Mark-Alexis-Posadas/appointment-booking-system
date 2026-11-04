CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP INDEX IF EXISTS "Appointment_providerId_startsAt_key";

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_provider_no_booked_overlap"
EXCLUDE USING GIST (
  "providerId" WITH =,
  tstzrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" = 'BOOKED');
