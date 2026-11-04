import { NextResponse } from "next/server";
import { loadProviderSlots } from "@/lib/availability-data";
import { providerSlotsQuerySchema } from "@/lib/schemas";
import { checkAvailabilityRateLimit } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const rate = checkAvailabilityRateLimit(clientIp);
  const rateHeaders = { "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": String(rate.remaining), "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)) };
  if (!rate.allowed) return NextResponse.json({ error: "Too many availability requests. Try again shortly." }, { status: 429, headers: rateHeaders });

  const { id } = await params;
  const url = new URL(request.url);
  const parsed = providerSlotsQuerySchema.safeParse({ date: url.searchParams.get("date"), serviceId: url.searchParams.get("serviceId") });
  if (!parsed.success || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    return NextResponse.json({ error: "Invalid provider, date, or service id.", details: parsed.success ? undefined : parsed.error.flatten().fieldErrors }, { status: 400, headers: rateHeaders });
  }

  const result = await loadProviderSlots(id, parsed.data.serviceId, parsed.data.date);
  if (!result) return NextResponse.json({ error: "Provider or active service not found, or service is not offered by this provider." }, { status: 404, headers: rateHeaders });
  return NextResponse.json({ slots: result.slots, businessTimezone: result.businessTimezone }, { headers: rateHeaders });
}
