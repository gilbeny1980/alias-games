import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { kvDel, kvGet, kvLock, kvSet } from "@/lib/kv";

// Admin sign-in by e-mail: the owner presses "send me a link", gets a one-time link by e-mail,
// and opening it signs them in (an HttpOnly cookie, 12 hours). Only ADMIN_EMAIL can ever receive it.
export const SESSION_COOKIE = "alias_admin";
export const COOKIE_PATH = "/api/alias/ads";
const LOGIN_TTL = 15 * 60; // the link works for 15 minutes, once
export const SESSION_TTL = 12 * 60 * 60;

export const adminEmail = () => (process.env.ADMIN_EMAIL || "gilbeny@gmail.com").trim().toLowerCase();
export const emailLoginConfigured = () => !!process.env.RESEND_API_KEY;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function maskEmail(e: string) {
  const [user, domain] = e.split("@");
  if (!domain) return e;
  return `${user[0]}${"*".repeat(Math.max(1, user.length - 2))}${user.length > 1 ? user[user.length - 1] : ""}@${domain}`;
}

// The link in the e-mail must point to OUR site, so never trust the request's Host header in production.
export function siteUrl(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return req.nextUrl.origin; // local development only
}

export async function newLoginToken(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await kvSet(`alias:admin:login:${sha(token)}`, 1, LOGIN_TTL);
  return token;
}

// single use: the first caller wins, even if two requests arrive together
export async function consumeLoginToken(token: string): Promise<boolean> {
  const h = sha(token);
  if (!(await kvLock(`alias:admin:used:${h}`, LOGIN_TTL))) return false;
  const exists = !!(await kvGet(`alias:admin:login:${h}`));
  await kvDel(`alias:admin:login:${h}`);
  return exists;
}

export async function newSession(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await kvSet(`alias:admin:session:${sha(token)}`, 1, SESSION_TTL);
  return token;
}

export async function verifyAdminSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return !!token && !!(await kvGet(`alias:admin:session:${sha(token)}`));
}

export async function endSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await kvDel(`alias:admin:session:${sha(token)}`);
}

export function sessionCookie(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

// ── sending the e-mail (Resend: https://resend.com, free; the sender onboarding@resend.dev can mail
// the address the Resend account was created with, no domain setup needed) ──
export async function sendLoginEmail(link: string): Promise<void> {
  const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Yuval <onboarding@resend.dev>",
      to: [adminEmail()],
      subject: "קישור כניסה לדשבורד יובל",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px">
        <h2>כניסה לדשבורד יובל</h2>
        <p>לחצו על הכפתור כדי להיכנס. הקישור בתוקף ל-15 דקות ופועל פעם אחת בלבד.</p>
        <p><a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold">כניסה לדשבורד</a></p>
        <p style="color:#666;font-size:13px">אם לא ביקשתם להיכנס, אפשר להתעלם מהמייל.</p></div>`,
      text: `כניסה לדשבורד יובל: ${link}\n(בתוקף ל-15 דקות, פעם אחת)`,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error("login e-mail failed", res.status, detail);
    throw new Error(res.status === 403 || res.status === 422 ? "MAIL_REJECTED" : "MAIL_FAILED");
  }
}
