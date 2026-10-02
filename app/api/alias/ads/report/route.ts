import { NextRequest, NextResponse } from "next/server";
import { listAds } from "@/lib/alias/adsStore";

// An advertiser's own numbers, found by their private report token.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ad = t ? (await listAds()).find((a) => a.reportToken === t) : undefined;
  if (!ad) return new NextResponse(null, { status: 404 });
  return NextResponse.json(
    {
      business: ad.business,
      text: ad.text,
      status: ad.status,
      impressions: ad.impressions,
      clicks: ad.clicks,
      pricePerClick: ad.pricePerClick,
      due: Math.round(ad.clicks * ad.pricePerClick * 100) / 100,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
