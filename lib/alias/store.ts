import { kvDel, kvGet, kvLock, kvProvider, kvSet, kvUnlock } from "@/lib/kv";
import type { AliasRoom } from "@/types/alias";

// On Vercel every request can hit a different server, so rooms MUST live in a real database.
// (Locally, in-memory storage is fine.)
export const STORAGE_ERROR = "האתר עדיין לא מחובר למסד הנתונים, ולכן אי אפשר לפתוח משחק. בעל האתר צריך להשלים את ההגדרה ב-Vercel (Storage).";
export const storageReady = () => kvProvider() !== "memory" || !process.env.VERCEL;

const ROOM_TTL = 60 * 60 * 24; // rooms vanish after a day
const key = (code: string) => `alias:room:${code}`;

export const getRoom = (code: string) => kvGet<AliasRoom>(key(code));
export const saveRoom = (room: AliasRoom) => kvSet(key(room.code), room, ROOM_TTL);
export const deleteRoom = (code: string) => kvDel(key(code));

// ── Per-room lock, so two players acting at once don't overwrite each other ──
export async function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = `alias:lock:${code}`;
  const deadline = Date.now() + 5000;
  let owner: string | null;
  while (!(owner = await kvLock(lockKey, 5))) {
    if (Date.now() > deadline) throw new Error("החדר עסוק, נסו שוב");
    await new Promise((r) => setTimeout(r, 60));
  }
  try {
    return await fn();
  } finally {
    await kvUnlock(lockKey, owner);
  }
}
