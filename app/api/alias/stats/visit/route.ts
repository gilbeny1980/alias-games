import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/alias/adsStore";
import { recordVisit, validVisitorId } from "@/lib/alias/stats";
import { storageReady } from "@/lib/alias/store";

// The game page calls this once per visit with an anonymous random device id.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || !validVisitorId(body.id) || !storageReady()) return NextResponse.json({ ok: false });
  try {
    await recordVisit(body.id, clientIp(req));
  } catch {
    // counting visitors must never get in the player's way
  }
  return NextResponse.json({ ok: true });
}
