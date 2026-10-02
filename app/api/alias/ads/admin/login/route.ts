import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import {
  COOKIE_PATH,
  SESSION_TTL,
  adminEmail,
  consumeLoginToken,
  emailLoginConfigured,
  endSession,
  maskEmail,
  newLoginToken,
  newSession,
  sendLoginEmail,
  sessionCookie,
  siteUrl,
} from "@/lib/alias/adminAuth";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Which sign-in methods exist (so the page knows what to offer). Reveals only a masked address.
export async function GET() {
  return NextResponse.json(
    { email: emailLoginConfigured(), key: !!process.env.ADS_ADMIN_KEY, to: maskEmail(adminEmail()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { action?: string; token?: string } | null;
  if (!body) return bad("בקשה לא תקינה");

  if (body.action === "request") {
    if (!emailLoginConfigured()) return bad("שליחת מייל עדיין לא הוגדרה בשרת (חסר RESEND_API_KEY)", 503);
    // at most 3 e-mails per 10 minutes, so nobody can flood the owner's inbox
    const key = "alias:admin:loginreq";
    const sent = (await kvGet<number>(key)) ?? 0;
    if (sent >= 3) return bad("נשלחו כבר כמה קישורים. נסו שוב בעוד כמה דקות.", 429);
    await kvSet(key, sent + 1, 600);
    try {
      const token = await newLoginToken();
      await sendLoginEmail(`${siteUrl(req)}/admin?token=${token}`);
    } catch (e) {
      const rejected = e instanceof Error && e.message === "MAIL_REJECTED";
      return bad(
        rejected
          ? "שירות המייל דחה את השליחה. ב-Resend החינמי אפשר לשלוח רק לכתובת שבה נרשמתם."
          : "שליחת המייל נכשלה. נסו שוב.",
        502,
      );
    }
    return NextResponse.json({ ok: true, to: maskEmail(adminEmail()) });
  }

  if (body.action === "verify") {
    if (!body.token || typeof body.token !== "string" || body.token.length > 100 || !(await consumeLoginToken(body.token)))
      return bad("הקישור לא תקין או שפג תוקפו. בקשו קישור חדש.", 401);
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", sessionCookie(await newSession(), SESSION_TTL));
    return res;
  }

  if (body.action === "logout") {
    await endSession(req);
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", `alias_admin=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=0`);
    return res;
  }

  return bad("פעולה לא מוכרת");
}
