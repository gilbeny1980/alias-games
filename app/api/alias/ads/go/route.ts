import { NextRequest, NextResponse } from "next/server";
import { clientIp, firstHit, getConfig, listAds, mutateAds } from "@/lib/alias/adsStore";

// Every visit to an advertiser goes through here so it can be counted (and billed).
// The same visitor opening the same ad again within an hour is not counted twice,
// and link-preview / crawler requests are not counted at all.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const cfg = await getConfig();
  const ad = cfg.enabled ? (await listAds()).find((a) => a.id === id && a.status === "approved") : undefined;
  if (!ad) return new NextResponse(null, { status: 404 });

  const bot = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slurp|headless/i.test(req.headers.get("user-agent") ?? "");
  if (!bot && (await firstHit(`alias:ads:click:${id}:${clientIp(req)}`, 3600))) {
    await mutateAds((ads) => {
      const a = ads.find((x) => x.id === id);
      if (a) a.clicks += 1;
    });
  }
  return NextResponse.redirect(ad.href, 302);
}
