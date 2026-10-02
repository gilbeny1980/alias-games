import { NextRequest, NextResponse } from "next/server";
import { kvDel, kvGet, kvProvider, kvSet } from "@/lib/kv";
import { storageReady } from "@/lib/alias/store";

// Shows which storage is active ("turso", "redis" or "memory"). Reveals no secrets.
// Add ?check=1 to also do a real write/read against the database.
export async function GET(req: NextRequest) {
  const out: Record<string, unknown> = { storage: kvProvider(), ready: storageReady() };
  if (req.nextUrl.searchParams.get("check") === "1" && out.ready) {
    try {
      const probe = String(Date.now());
      await kvSet("alias:health", probe, 60);
      out.roundTrip = (await kvGet<string>("alias:health")) === probe ? "ok" : "mismatch";
      await kvDel("alias:health");
    } catch (e) {
      // only the error text, never connection details
      out.roundTrip = "error";
      out.error = e instanceof Error ? e.message.slice(0, 160) : "unknown";
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
