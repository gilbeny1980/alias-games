import { NextRequest, NextResponse } from "next/server";
import { AdError, AdStatus, IMAGE_PATH, applyEdit, buildAd, checkAdmin, cleanImageDataUrl, getConfig, imageKey, listAds, mutateAds, saveConfig } from "@/lib/alias/adsStore";
import { kvDel, kvSet } from "@/lib/kv";

const STATUSES: AdStatus[] = ["pending", "approved", "paused", "rejected"];

async function guard(req: NextRequest): Promise<NextResponse | null> {
  const r = await checkAdmin(req);
  if (r === "ok") return null;
  if (r === "off") return new NextResponse(null, { status: 404 }); // ADS_ADMIN_KEY not set: admin does not exist
  if (r === "locked") return NextResponse.json({ error: "יותר מדי ניסיונות, נסו בעוד דקה" }, { status: 429 });
  return NextResponse.json({ error: "מפתח שגוי" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  return NextResponse.json({ config: await getConfig(), ads: await listAds() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  try {
    switch (body.action) {
      case "setConfig": {
        const cfg = await getConfig();
        if (typeof body.enabled === "boolean") cfg.enabled = body.enabled;
        if (typeof body.adsense === "boolean") cfg.adsense = body.adsense;
        await saveConfig(cfg);
        break;
      }
      case "create": // a deal made outside the form: goes live as soon as ads are enabled
        await mutateAds((ads) => void ads.push(buildAd(body, "approved")));
        break;
      case "setStatus": {
        if (!STATUSES.includes(body.status as AdStatus)) throw new AdError("סטטוס לא תקין");
        await mutateAds((ads) => {
          const ad = ads.find((a) => a.id === body.id);
          if (!ad) throw new AdError("פרסומת לא נמצאה");
          ad.status = body.status as AdStatus;
        });
        break;
      }
      case "update":
        await mutateAds((ads) => {
          const ad = ads.find((a) => a.id === body.id);
          if (!ad) throw new AdError("פרסומת לא נמצאה");
          applyEdit(ad, body);
        });
        break;
      case "uploadImage": {
        const dataUrl = cleanImageDataUrl(body.dataUrl);
        const id = String(body.id ?? "");
        if (!(await listAds()).some((a) => a.id === id)) throw new AdError("פרסומת לא נמצאה");
        await kvSet(imageKey(id), dataUrl);
        await mutateAds((ads) => {
          const ad = ads.find((a) => a.id === id);
          if (ad) ad.imageUrl = `${IMAGE_PATH}${id}?v=${Date.now()}`;
        });
        break;
      }
      case "removeImage": {
        const id = String(body.id ?? "");
        await kvDel(imageKey(id));
        await mutateAds((ads) => {
          const ad = ads.find((a) => a.id === id);
          if (ad) delete ad.imageUrl;
        });
        break;
      }
      case "delete":
        await mutateAds((ads) => {
          const i = ads.findIndex((a) => a.id === body.id);
          if (i >= 0) ads.splice(i, 1);
        });
        await kvDel(imageKey(String(body.id ?? "")));
        break;
      default:
        throw new AdError("פעולה לא מוכרת");
    }
  } catch (e) {
    if (e instanceof AdError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
  return NextResponse.json({ config: await getConfig(), ads: await listAds() });
}
