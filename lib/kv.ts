// Generic Upstash Redis-backed key/value store, with an in-memory fallback
// for local dev when Redis env vars aren't set.
const mem: Record<string, unknown> = {};

type RedisClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options?: { ex: number }) => Promise<void>;
  del: (key: string) => Promise<void>;
};

function getRedis(): RedisClient | null {
  // Vercel's own Marketplace "KV" storage (Upstash-backed) injects
  // KV_REST_API_URL/TOKEN instead of the plain Upstash names.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");
    return new Redis({ url, token }) as RedisClient;
  }
  return null;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  return r ? ((await r.get(key)) as T | null) : ((mem[key] as T) ?? null);
}
export async function kvSet(key: string, value: unknown, ex?: number): Promise<void> {
  const r = getRedis();
  if (r) await r.set(key, value, ex ? { ex } : undefined);
  else mem[key] = value;
}
export async function kvDel(key: string): Promise<void> {
  const r = getRedis();
  if (r) await r.del(key);
  else delete mem[key];
}
