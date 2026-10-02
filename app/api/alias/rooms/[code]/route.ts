import { NextRequest, NextResponse } from "next/server";
import { Action, addPlayer, applyAction, checkRoomPassword, GameError, LOCK_MS, MAX_BAD_ATTEMPTS, viewFor } from "@/lib/alias/game";
import { deleteRoom, getRoom, saveRoom, STORAGE_ERROR, storageReady, withRoomLock } from "@/lib/alias/store";

type Ctx = { params: Promise<{ code: string }> };
const noRoom = () => NextResponse.json({ error: "החדר לא נמצא" }, { status: 404 });

export async function GET(req: NextRequest, { params }: Ctx) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room) return noRoom();
  // only players of the room may read it, so a password-protected room leaks nothing
  const view = viewFor(room, req.nextUrl.searchParams.get("p"));
  if (!view.me) return NextResponse.json({ error: "אינך חלק מהחדר" }, { status: 403 });
  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!storageReady()) return NextResponse.json({ error: STORAGE_ERROR }, { status: 503 });
  const { code } = await params;
  let body: Action & { playerId?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  try {
    return await withRoomLock(code, async () => {
      const room = await getRoom(code);
      if (!room) return noRoom();

      if (body.action === "join") {
        const now = Date.now();
        if (room.lockUntil && now < room.lockUntil)
          return NextResponse.json({ error: "יותר מדי ניסיונות. נסו שוב בעוד דקה" }, { status: 429 });
        if (!checkRoomPassword(room, body.password)) {
          room.badAttempts = (room.badAttempts ?? 0) + 1;
          if (room.badAttempts >= MAX_BAD_ATTEMPTS) {
            room.lockUntil = now + LOCK_MS;
            room.badAttempts = 0;
          }
          await saveRoom(room);
          return NextResponse.json({ error: "סיסמה שגויה" }, { status: 403 });
        }
        room.badAttempts = 0;
        const player = addPlayer(room, String(body.name ?? ""));
        room.version += 1;
        await saveRoom(room);
        return NextResponse.json({ code, playerId: player.id, view: viewFor(room, player.id) });
      }

      const playerId = String(body.playerId ?? "");
      applyAction(room, playerId, body);
      if (room.players.length === 0) {
        await deleteRoom(code);
        return NextResponse.json({ left: true });
      }
      await saveRoom(room);
      return NextResponse.json({ view: viewFor(room, playerId) });
    });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error ? e.message : "שגיאת שרת";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
