// Key/value storage used for rooms, ads and counters. Providers, in order:
//   1. Turso (libSQL)   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN   (Vercel Marketplace → Turso)
//   2. Upstash Redis    UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN
//   3. in-memory        local development only (does not work on Vercel: every request can hit a different server)
import type { Client } from "@libsql/client";

export type KvProvider = "turso" | "redis" | "memory";

const redisCreds = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export function kvProvider(): KvProvider {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return "turso";
  if (process.env.TURSO_DATABASE_URL?.startsWith("file:")) return "turso"; // local libSQL file, for tests
  const r = redisCreds();
  return r.url && r.token ? "redis" : "memory";
}

// ── memory ──────────────────────────────────────────────────────────────────
const mem = new Map<string, { v: unknown; exp: number | null }>();

// ── Turso ───────────────────────────────────────────────────────────────────
let tursoClient: Client | null = null;
let tursoReady: Promise<unknown> | null = null;

async function turso(): Promise<Client> {
  if (!tursoClient) {
    const raw = process.env.TURSO_DATABASE_URL!;
    // the web build talks plain HTTPS (good for serverless); the node build is only needed for local files
    const mod = raw.startsWith("file:") ? await import("@libsql/client") : await import("@libsql/client/web");
    tursoClient = mod.createClient({ url: raw.replace(/^libsql:\/\//, "https://"), authToken: process.env.TURSO_AUTH_TOKEN });
  }
  tursoReady ??= tursoClient.execute("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, exp INTEGER)");
  await tursoReady;
  return tursoClient;
}

// ── Redis ───────────────────────────────────────────────────────────────────
type RedisClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options?: { ex?: number; nx?: boolean }) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};
function redis(): RedisClient {
  const { url, token } = redisCreds();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis");
  return new Redis({ url, token }) as RedisClient;
}

// ── public API ──────────────────────────────────────────────────────────────
export async function kvGet<T>(key: string): Promise<T | null> {
  switch (kvProvider()) {
    case "turso": {
      const r = await (await turso()).execute({ sql: "SELECT v FROM kv WHERE k = ? AND (exp IS NULL OR exp > ?)", args: [key, Date.now()] });
      return r.rows[0] ? (JSON.parse(String(r.rows[0].v)) as T) : null;
    }
    case "redis":
      return (await redis().get(key)) as T | null;
    default: {
      const e = mem.get(key);
      if (!e || (e.exp !== null && e.exp <= Date.now())) return null;
      return e.v as T;
    }
  }
}

export async function kvSet(key: string, value: unknown, ex?: number): Promise<void> {
  switch (kvProvider()) {
    case "turso": {
      const c = await turso();
      await c.execute({
        sql: "INSERT INTO kv (k, v, exp) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = excluded.exp",
        args: [key, JSON.stringify(value), ex ? Date.now() + ex * 1000 : null],
      });
      // now and then, sweep expired rows
      if (Math.random() < 0.02) await c.execute({ sql: "DELETE FROM kv WHERE exp IS NOT NULL AND exp <= ?", args: [Date.now()] });
      return;
    }
    case "redis":
      await redis().set(key, value, ex ? { ex } : undefined);
      return;
    default:
      mem.set(key, { v: value, exp: ex ? Date.now() + ex * 1000 : null });
  }
}

export async function kvDel(key: string): Promise<void> {
  switch (kvProvider()) {
    case "turso":
      await (await turso()).execute({ sql: "DELETE FROM kv WHERE k = ?", args: [key] });
      return;
    case "redis":
      await redis().del(key);
      return;
    default:
      mem.delete(key);
  }
}

// Atomic "take the lock if free": returns an owner token, or null if someone else holds it.
export async function kvLock(key: string, ttlSec: number): Promise<string | null> {
  const owner = Math.random().toString(36).slice(2);
  switch (kvProvider()) {
    case "turso": {
      const c = await turso();
      const now = Date.now();
      await c.execute({ sql: "DELETE FROM kv WHERE k = ? AND exp IS NOT NULL AND exp <= ?", args: [key, now] });
      const r = await c.execute({ sql: "INSERT OR IGNORE INTO kv (k, v, exp) VALUES (?, ?, ?)", args: [key, JSON.stringify(owner), now + ttlSec * 1000] });
      return r.rowsAffected === 1 ? owner : null;
    }
    case "redis":
      return (await redis().set(key, owner, { nx: true, ex: ttlSec })) ? owner : null;
    default: {
      const e = mem.get(key);
      if (e && (e.exp === null || e.exp > Date.now())) return null;
      mem.set(key, { v: owner, exp: Date.now() + ttlSec * 1000 });
      return owner;
    }
  }
}

export async function kvUnlock(key: string, owner: string): Promise<void> {
  switch (kvProvider()) {
    case "turso":
      await (await turso()).execute({ sql: "DELETE FROM kv WHERE k = ? AND v = ?", args: [key, JSON.stringify(owner)] });
      return;
    case "redis":
      if ((await redis().get(key)) === owner) await redis().del(key);
      return;
    default:
      if (mem.get(key)?.v === owner) mem.delete(key);
  }
}
