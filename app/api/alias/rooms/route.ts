import { NextRequest, NextResponse } from "next/server";
import { createRoom, GameError, newCode, viewFor } from "@/lib/alias/game";
import { getRoom, saveRoom } from "@/lib/alias/store";

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json();
    let code = newCode();
    for (let i = 0; i < 20 && (await getRoom(code)); i++) code = newCode();
    const { room, player } = createRoom(code, name, password);
    await saveRoom(room);
    return NextResponse.json({ code, playerId: player.id, view: viewFor(room, player.id) });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
