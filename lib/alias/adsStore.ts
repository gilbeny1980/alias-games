import { randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { withRoomLock } from "@/lib/alias/store";
import { PLACEMENTS, type Placement } from "@/lib/alias/ads";

export type AdStatus = "pending" | "approved" | "paused" | "rejected";

export interface Ad {
  id: string;
  reportToken: string; // lets the advertiser view their own numbers
  business: string;
  contact: string;
  text: string;
  href: string;
  imageUrl?: string;
  cta?: string;
  placements: Placement[];
  status: AdStatus;
  pricePerClick: number; // ₪ per visit that came through the game
  impressions: number;
  clicks: number;
  createdAt: number;
}

export interface AdsConfig {
  enabled: boolean; // master switch: nothing is shown while false
  adsense: boolean;
}

export class AdError extends Error {}

const CFG_KEY = "alias:ads:config";
const ADS_KEY = "alias:ads:items";

export async function getConfig(): Promise<AdsConfig> {
  return { enabled: false, adsense: false, ...((await kvGet<AdsConfig>(CFG_KEY)) ?? {}) };
}
export const saveConfig = (c: AdsConfig) => kvSet(CFG_KEY, c);
export async function listAds(): Promise<Ad[]> {
  return (await kvGet<Ad[]>(ADS_KEY)) ?? [];
}
// serialised read-modify-write
export function mutateAds<T>(fn: (ads: Ad[]) => T): Promise<T> {
  return withRoomLock("__ads__", async () => {
    const ads = await listAds();
    const out = fn(ads);
    await kvSet(ADS_KEY, ads);
    return out;
  });
}

// ── uploaded banner images (stored under their own key, served by /api/alias/ads/img/[id]) ──
export const imageKey = (id: string) => `alias:ads:img:${id}`;
export const IMAGE_PATH = "/api/alias/ads/img/";
const MAX_IMAGE_CHARS = 400_000; // ~300KB
export function cleanImageDataUrl(v: unknown): string {
  const s = String(v ?? "");
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) || s.length > MAX_IMAGE_CHARS)
    throw new AdError("תמונה לא תקינה או גדולה מדי");
  return s;
}

// ── validation ──────────────────────────────────────────────────────────────
function cleanUrl(v: unknown, required: boolean, allowOwnImage = false): string | undefined {
  const raw = String(v ?? "").trim();
  if (allowOwnImage && /^\/api\/alias\/ads\/img\/[a-f0-9]{12}(\?v=\d+)?$/.test(raw)) return raw;
  if (!raw) {
    if (required) throw new AdError("חסר קישור");
    return undefined;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AdError("קישור לא תקין");
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || raw.length > 500) throw new AdError("קישור לא תקין");
  return u.toString();
}
const cleanText = (v: unknown, max: number, label: string, required = true) => {
  const t = String(v ?? "").trim().slice(0, max);
  if (required && !t) throw new AdError(`חסר ${label}`);
  return t;
};
const cleanPlacements = (v: unknown): Placement[] => {
  const arr = Array.isArray(v) ? v.filter((p): p is Placement => PLACEMENTS.includes(p as Placement)) : [];
  return arr.length ? Array.from(new Set(arr)) : [...PLACEMENTS];
};

export function buildAd(body: Record<string, unknown>, status: AdStatus): Ad {
  return {
    id: randomBytes(6).toString("hex"),
    reportToken: randomBytes(16).toString("hex"),
    business: cleanText(body.business, 60, "שם העסק"),
    contact: cleanText(body.contact, 80, "פרטי קשר"),
    text: cleanText(body.text, 80, "כותרת"),
    href: cleanUrl(body.href, true)!,
    imageUrl: cleanUrl(body.imageUrl, false, true),
    cta: cleanText(body.cta, 16, "", false) || undefined,
    placements: cleanPlacements(body.placements),
    status,
    pricePerClick: Math.max(0, Math.min(1000, Number(body.pricePerClick) || 0)),
    impressions: 0,
    clicks: 0,
    createdAt: Date.now(),
  };
}

export function applyEdit(ad: Ad, body: Record<string, unknown>) {
  if ("text" in body) ad.text = cleanText(body.text, 80, "כותרת");
  if ("href" in body) ad.href = cleanUrl(body.href, true)!;
  if ("imageUrl" in body) ad.imageUrl = cleanUrl(body.imageUrl, false, true);
  if ("cta" in body) ad.cta = cleanText(body.cta, 16, "", false) || undefined;
  if ("placements" in body) ad.placements = cleanPlacements(body.placements);
  if ("pricePerClick" in body) ad.pricePerClick = Math.max(0, Math.min(1000, Number(body.pricePerClick) || 0));
}

// ── small helpers ───────────────────────────────────────────────────────────
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// true the first time within `seconds`, false for repeats (used to dedupe clicks)
export async function firstHit(key: string, seconds: number): Promise<boolean> {
  if (await kvGet(key)) return false;
  await kvSet(key, 1, seconds);
  return true;
}

// Admin check: ADS_ADMIN_KEY must be set (otherwise the whole admin is off) and
// a wrong key 5 times in a row locks guessing for a minute.
export async function checkAdmin(req: NextRequest): Promise<"ok" | "off" | "denied" | "locked"> {
  const admin = process.env.ADS_ADMIN_KEY;
  if (!admin) return "off";
  const state = (await kvGet<{ n: number; until: number }>("alias:ads:adminfail")) ?? { n: 0, until: 0 };
  if (Date.now() < state.until) return "locked";
  const a = Buffer.from(req.headers.get("x-admin-key") ?? "");
  const b = Buffer.from(admin);
  if (a.length === b.length && timingSafeEqual(a, b)) {
    if (state.n) await kvSet("alias:ads:adminfail", { n: 0, until: 0 });
    return "ok";
  }
  const n = state.n + 1;
  await kvSet("alias:ads:adminfail", n >= 5 ? { n: 0, until: Date.now() + 60_000 } : { n, until: 0 });
  return "denied";
}
