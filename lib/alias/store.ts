import { kvDel, kvGet, kvSet } from "@/lib/kv";
import type { AliasRoom } from "@/types/alias";

// On Vercel every request can hit a different server, so rooms MUST live in Redis.
// (Locally, in-memory storage is fine.)
export const STORAGE_ERROR = "האתר עדיין לא מחובר למסד הנתונים (Redis), ולכן אי אפשר לפתוח משחק. בעל האתר צריך להשלים את ההגדרה ב-Vercel.";
export function storageReady(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return !!(url && token) || !process.env.VERCEL;
}

const ROOM_TTL = 60 * 60 * 24; // rooms vanish after a day
const key = (code: string) => `alias:room:${code}`;

export const getRoom = (code: string) => kvGet<AliasRoom>(key(code));
export const saveRoom = (room: AliasRoom) => kvSet(key(room.code), room, ROOM_TTL);
export const deleteRoom = (code: string) => kvDel(key(code));

// ── Per-room lock, so two players acting at once don't overwrite each other ──
const memLocks = new Map<string, Promise<unknown>>();

function redisUrl() {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  };
}

export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const { url, token } = redisUrl();
  if (!url || !token) {
    // single-process dev fallback: chain operations per room
    const prev = memLocks.get(code) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    memLocks.set(code, run.catch(() => undefined));
    return run;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis");
  const redis = new Redis({ url, token });
  const lockKey = `alias:lock:${code}`;
  const owner = Math.random().toString(36).slice(2);
  const deadline = Date.now() + 5000;
  for (;;) {
    const got = await redis.set(lockKey, owner, { nx: true, ex: 5 });
    if (got) break;
    if (Date.now() > deadline) throw new Error("החדר עסוק, נסו שוב");
    await new Promise((r) => setTimeout(r, 80));
  }
  try {
    return await fn();
  } finally {
    if ((await redis.get(lockKey)) === owner) await redis.del(lockKey);
  }
}
