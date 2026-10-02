import { NextRequest, NextResponse } from "next/server";
import { AdError, buildAd, clientIp, listAds, mutateAds } from "@/lib/alias/adsStore";
import { kvGet, kvSet } from "@/lib/kv";

// An advertiser proposes an ad. It stays "pending" and invisible until the owner approves it.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  if (body.website) return NextResponse.json({ ok: true }); // honeypot field: bots fill it in

  const rlKey = `alias:ads:submit:${clientIp(req)}`;
  const sent = (await kvGet<number>(rlKey)) ?? 0;
  if (sent >= 5) return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב מאוחר יותר" }, { status: 429 });
  if ((await listAds()).filter((a) => a.status === "pending").length >= 50)
    return NextResponse.json({ error: "התור מלא כרגע, נסו שוב בהמשך" }, { status: 429 });

  try {
    const ad = buildAd({ ...body, pricePerClick: 0 }, "pending"); // the owner sets the price
    await mutateAds((ads) => void ads.push(ad));
    await kvSet(rlKey, sent + 1, 3600);
    return NextResponse.json({ ok: true, reportToken: ad.reportToken });
  } catch (e) {
    if (e instanceof AdError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
