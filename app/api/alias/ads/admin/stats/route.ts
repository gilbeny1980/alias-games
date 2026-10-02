import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/alias/adsStore";
import { getStats } from "@/lib/alias/stats";

// Usage numbers for the signed-in owner (same sign-in as the rest of the dashboard)
export async function GET(req: NextRequest) {
  const r = await checkAdmin(req);
  if (r === "off") return new NextResponse(null, { status: 404 });
  if (r === "locked") return NextResponse.json({ error: "יותר מדי ניסיונות, נסו בעוד דקה" }, { status: 429 });
  if (r !== "ok") return NextResponse.json({ error: "נדרשת כניסה" }, { status: 401 });
  return NextResponse.json(await getStats(), { headers: { "Cache-Control": "no-store" } });
}
