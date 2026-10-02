import { NextRequest, NextResponse } from "next/server";
import { getConfig, mutateAds } from "@/lib/alias/adsStore";

export async function POST(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (!(await getConfig()).enabled) return NextResponse.json({ ok: false });
  await mutateAds((ads) => {
    const ad = ads.find((a) => a.id === String(id) && a.status === "approved");
    if (ad) ad.impressions += 1;
  });
  return NextResponse.json({ ok: true });
}
