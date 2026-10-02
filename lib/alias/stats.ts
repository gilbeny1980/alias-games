import { createHash } from "crypto";
import { kvGet, kvSet } from "@/lib/kv";
import { firstHit } from "@/lib/alias/adsStore";
import { withRoomLock } from "@/lib/alias/store";

// Anonymous usage numbers for the owner's dashboard. A "user" is a device/browser: it gets a random
// id the first time it opens the game, with no name, e-mail or any personal data.
export interface DayStats {
  new: number; // devices seen for the first time that day
  active: number; // different devices that opened the game that day
  rooms: number; // games created
  ids: string[]; // short hashes of that day's devices (kept for 7 days to count unique users per week)
}
export interface Stats {
  total: number; // all devices ever
  rooms: number; // all games ever created
  days: Record<string, DayStats>;
}

const KEY = "alias:stats";
const KEEP_DAYS = 90;
const KEEP_IDS_DAYS = 7;
const MAX_IDS_PER_DAY = 3000;

// calendar day in Israel (YYYY-MM-DD)
export function dayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const short = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 10);

const empty = (): Stats => ({ total: 0, rooms: 0, days: {} });
const dayOf = (s: Stats, d: string): DayStats => (s.days[d] ??= { new: 0, active: 0, rooms: 0, ids: [] });

function prune(s: Stats) {
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete s.days[k];
  for (const k of keys.slice(-KEEP_DAYS, -KEEP_IDS_DAYS)) if (s.days[k]) s.days[k].ids = [];
}

export const validVisitorId = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9-]{20,40}$/i.test(id);

export async function recordVisit(visitorId: string, ip: string): Promise<void> {
  const d = dayKey();
  const isNew = await firstHit(`alias:stat:seen:${visitorId}`, 60 * 60 * 24 * 400);
  const activeToday = await firstHit(`alias:stat:act:${d}:${visitorId}`, 60 * 60 * 48);
  if (!isNew && !activeToday) return;
  // a single address can't invent more than 40 new devices a day
  if (isNew) {
    const ipKey = `alias:stat:ip:${d}:${ip}`;
    const n = (await kvGet<number>(ipKey)) ?? 0;
    if (n >= 40) return;
    await kvSet(ipKey, n + 1, 60 * 60 * 30);
  }
  await withRoomLock("__stats__", async () => {
    const s = (await kvGet<Stats>(KEY)) ?? empty();
    const day = dayOf(s, d);
    if (isNew) { s.total += 1; day.new += 1; }
    if (activeToday) {
      day.active += 1;
      if (day.ids.length < MAX_IDS_PER_DAY) day.ids.push(short(visitorId));
    }
    prune(s);
    await kvSet(KEY, s);
  });
}

export async function recordRoomCreated(): Promise<void> {
  try {
    await withRoomLock("__stats__", async () => {
      const s = (await kvGet<Stats>(KEY)) ?? empty();
      s.rooms += 1;
      dayOf(s, dayKey()).rooms += 1;
      await kvSet(KEY, s);
    });
  } catch {
    // statistics must never break creating a game
  }
}

export interface StatsSummary {
  total: number;
  rooms: number;
  today: { new: number; active: number; rooms: number };
  yesterday: { new: number; active: number; rooms: number };
  unique7: number; // different devices in the last 7 days
  days: { day: string; new: number; active: number; rooms: number }[]; // last 14 days, oldest first
}

export async function getStats(): Promise<StatsSummary> {
  const s = (await kvGet<Stats>(KEY)) ?? empty();
  const out: StatsSummary["days"] = [];
  const unique = new Set<string>();
  for (let i = 13; i >= 0; i--) {
    const d = dayKey(new Date(Date.now() - i * 86400000));
    const v = s.days[d];
    out.push({ day: d, new: v?.new ?? 0, active: v?.active ?? 0, rooms: v?.rooms ?? 0 });
    if (i < 7 && v) v.ids.forEach((x) => unique.add(x));
  }
  const last = (n: number) => out[out.length - n];
  return {
    total: s.total,
    rooms: s.rooms,
    today: { new: last(1).new, active: last(1).active, rooms: last(1).rooms },
    yesterday: { new: last(2).new, active: last(2).active, rooms: last(2).rooms },
    unique7: unique.size,
    days: out,
  };
}
