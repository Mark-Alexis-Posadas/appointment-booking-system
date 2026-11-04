type Bucket = { count: number; resetAt: number };
const globalForRateLimit = globalThis as unknown as { availabilityRateLimit?: Map<string, Bucket> };
const buckets = globalForRateLimit.availabilityRateLimit ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForRateLimit.availabilityRateLimit = buckets;

export function checkAvailabilityRateLimit(key: string, now = Date.now(), limit = 60, windowMs = 60_000): { allowed: boolean; remaining: number; resetAt: number } {
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
  }
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}
