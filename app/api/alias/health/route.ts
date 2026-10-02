import { NextResponse } from "next/server";

// Tells you whether rooms are stored in Redis (needed in production) or only in memory.
// Reveals no secrets: just which storage is active.
export function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return NextResponse.json({ storage: url && token ? "redis" : "memory" }, { headers: { "Cache-Control": "no-store" } });
}
