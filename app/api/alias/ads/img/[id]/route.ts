import { NextRequest } from "next/server";
import { kvGet } from "@/lib/kv";
import { imageKey } from "@/lib/alias/adsStore";

// Serves a banner image the owner uploaded in /admin
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{12}$/.test(id)) return new Response(null, { status: 404 });
  const dataUrl = await kvGet<string>(imageKey(id));
  const m = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response(null, { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "X-Content-Type-Options": "nosniff",
      // the URL carries ?v=<timestamp>, so a new upload gets a new URL
      "Cache-Control": "public, max-age=86400",
    },
  });
}
