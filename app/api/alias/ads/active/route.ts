import { NextRequest, NextResponse } from "next/server";
import { ADSENSE_CLIENT, ADSENSE_SLOTS, PLACEMENTS, type Placement } from "@/lib/alias/ads";
import { getConfig, listAds } from "@/lib/alias/adsStore";

// What to show in a placement. Empty unless the owner switched ads on AND approved an ad.
export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get("placement") as Placement;
  const none = NextResponse.json({ ads: [], adsense: null }, { headers: { "Cache-Control": "no-store" } });
  if (!PLACEMENTS.includes(placement)) return none;
  const cfg = await getConfig();
  if (!cfg.enabled) return none;
  const ads = (await listAds())
    .filter((a) => a.status === "approved" && a.placements.includes(placement))
    .map(({ id, text, imageUrl, cta }) => ({ id, text, imageUrl, cta }));
  const slot = ADSENSE_SLOTS[placement];
  const adsense = cfg.adsense && ADSENSE_CLIENT && slot ? { client: ADSENSE_CLIENT, slot } : null;
  return NextResponse.json({ ads, adsense }, { headers: { "Cache-Control": "no-store" } });
}
