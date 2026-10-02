"use client";
import { useCallback, useEffect, useState } from "react";
import { PLACEMENTS, PLACEMENT_LABELS, type Placement } from "@/lib/alias/ads";
import type { Ad, AdStatus, AdsConfig } from "@/lib/alias/adsStore";
import type { StatsSummary } from "@/lib/alias/stats";

const KEY = "alias_admin_key";
const STATUS_LABEL: Record<AdStatus, string> = { pending: "ממתינה לאישור", approved: "מאושרת", paused: "מושהית", rejected: "נדחתה" };
const STATUS_STYLE: Record<AdStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  paused: "bg-gray-200 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

type Data = { config: AdsConfig; ads: Ad[] };

// Shrinks a chosen photo to a banner-sized JPEG (max 900px wide, under ~300KB)
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("לא ניתן לקרוא את התמונה"));
      i.src = url;
    });
    const scale = Math.min(1, 900 / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (out.length <= 380_000) return out;
    }
    throw new Error("התמונה גדולה מדי, נסו תמונה קטנה יותר");
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Methods = { email: boolean; key: boolean; to: string };

export default function AdminClient() {
  const [key, setKey] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [methods, setMethods] = useState<Methods | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState<StatsSummary | null>(null);

  // Calls the admin API. Signed in by the e-mail session cookie, or by the key if one was typed.
  const call = useCallback(async (k: string, body?: Record<string, unknown>, quiet = false) => {
    if (!quiet) setError("");
    const res = await fetch("/api/alias/ads/admin", {
      method: body ? "POST" : "GET",
      headers: { ...(k ? { "x-admin-key": k } : {}), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (!quiet && res.status !== 404) setError(json.error || (res.status === 401 ? "נדרשת כניסה" : "שגיאה"));
      return null;
    }
    setData(json);
    return json as Data;
  }, []);

  useEffect(() => {
    (async () => {
      // 1) arrived from the e-mail link: exchange the one-time token for a session
      const token = new URLSearchParams(location.search).get("token");
      if (token) {
        history.replaceState(null, "", location.pathname); // keep the token out of the address bar
        const r = await fetch("/api/alias/ads/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", token }),
        });
        if (!r.ok) setError((await r.json().catch(() => ({}))).error || "הקישור לא תקין");
      }
      // 2) already signed in (cookie) or a key saved for this tab?
      let saved = "";
      try { saved = sessionStorage.getItem(KEY) ?? ""; } catch {}
      if (saved) setKey(saved);
      const d = await call(saved, undefined, true);
      if (!d) {
        if (saved) try { sessionStorage.removeItem(KEY); } catch {}
        setMethods(await fetch("/api/alias/ads/admin/login", { cache: "no-store" }).then((r) => r.json()).catch(() => null));
      }
      setChecking(false);
    })();
  }, [call]);

  async function sendLink() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/alias/ads/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setError(j.error || "שגיאה");
      else setSentTo(j.to);
    } finally {
      setBusy(false);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const d = await call(key);
    if (d) try { sessionStorage.setItem(KEY, key); } catch {}
  }

  async function logout() {
    try { sessionStorage.removeItem(KEY); } catch {}
    await fetch("/api/alias/ads/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setData(null);
    setKey("");
    setSentTo("");
    setMethods(await fetch("/api/alias/ads/admin/login", { cache: "no-store" }).then((r) => r.json()).catch(() => null));
  }

  const act = (body: Record<string, unknown>) => call(key, body);

  // usage numbers, loaded once signed in
  const signedIn = !!data;
  useEffect(() => {
    if (!signedIn) return;
    fetch("/api/alias/ads/admin/stats", { headers: key ? { "x-admin-key": key } : {}, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [signedIn, key]);

  const shell = "min-h-[100dvh] bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 flex justify-center";

  if (checking)
    return <div className={shell}><p className="text-white mt-16">טוען...</p></div>;

  if (!data && methods && !methods.email && !methods.key)
    return (
      <div className={shell}>
        <div className="w-full max-w-md bg-white rounded-3xl p-6 mt-10 h-fit text-center space-y-2">
          <h1 className="text-xl font-bold">ניהול הפרסומות כבוי</h1>
          <p className="text-sm text-gray-600">
            כדי להפעיל אותו, הגדירו בשרת <code dir="ltr">RESEND_API_KEY</code> (כניסה במייל) או <code dir="ltr">ADS_ADMIN_KEY</code> (כניסה עם מפתח).
          </p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className={shell}>
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 mt-10 h-fit space-y-4">
          <h1 className="text-xl font-bold text-center">ניהול פרסומות</h1>

          {methods?.email && (
            sentTo ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-1">
                <div className="text-3xl">📧</div>
                <p className="font-bold text-green-800">שלחנו קישור כניסה</p>
                <p className="text-sm text-green-700" dir="ltr">{sentTo}</p>
                <p className="text-xs text-gray-500">פתחו את המייל ולחצו על הכפתור. הקישור בתוקף ל-15 דקות. אם לא הגיע, בדקו בספאם.</p>
                <button onClick={sendLink} disabled={busy} className="text-xs text-gray-500 underline">שלחו שוב</button>
              </div>
            ) : (
              <button onClick={sendLink} disabled={busy} className="w-full bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-lg">
                📧 שלח לי קישור כניסה למייל
                <span className="block text-xs font-normal opacity-90" dir="ltr">{methods.to}</span>
              </button>
            )
          )}

          {methods?.key && (
            <form onSubmit={login} className="space-y-2">
              {methods.email && <p className="text-center text-xs text-gray-400">או כניסה עם מפתח</p>}
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="מפתח ניהול"
                autoComplete="current-password"
                dir="ltr"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button className={`w-full font-bold py-3 rounded-xl ${methods.email ? "bg-gray-100 text-gray-700" : "bg-red-600 text-white"}`}>כניסה</button>
            </form>
          )}
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        </div>
      </div>
    );

  const pending = data.ads.filter((a) => a.status === "pending");
  const rest = data.ads.filter((a) => a.status !== "pending");
  const totalDue = data.ads.reduce((s, a) => s + a.clicks * a.pricePerClick, 0);

  return (
    <div className={shell}>
      <div className="w-full max-w-2xl space-y-4 py-4">
        <StatsCard stats={stats} />

        <div className="bg-white rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold">ניהול פרסומות</h1>
            <button onClick={logout} className="text-xs text-gray-500 underline">יציאה</button>
          </div>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>
              <b>פרסומות במשחק</b>
              <span className="block text-xs text-gray-500">כל עוד זה כבוי, שום פרסומת לא מופיעה, גם אם היא מאושרת.</span>
            </span>
            <input type="checkbox" checked={data.config.enabled} onChange={(e) => act({ action: "setConfig", enabled: e.target.checked })} className="w-6 h-6 accent-green-600" />
          </label>
          <label className="flex items-center justify-between rounded-xl border p-3">
            <span>
              <b>Google AdSense</b>
              <span className="block text-xs text-gray-500">דורש הגדרת משתני AdSense בשרת, ופועל רק כשהמתג הראשי דלוק.</span>
            </span>
            <input type="checkbox" checked={data.config.adsense} onChange={(e) => act({ action: "setConfig", adsense: e.target.checked })} className="w-6 h-6 accent-green-600" />
          </label>
          <p className="text-sm text-gray-600">סה״כ לגבייה מכל המפרסמים: <b>{Math.round(totalDue * 100) / 100} ₪</b></p>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <h2 className="text-white font-bold">ממתינות לאישור ({pending.length})</h2>
        {pending.length === 0 && <p className="text-red-100 text-sm">אין בקשות חדשות.</p>}
        {pending.map((a) => <AdCard key={a.id} ad={a} act={act} />)}

        <h2 className="text-white font-bold">שאר הפרסומות ({rest.length})</h2>
        {rest.map((a) => <AdCard key={a.id} ad={a} act={act} />)}

        <NewAd act={act} />
      </div>
    </div>
  );
}

type Act = (body: Record<string, unknown>) => Promise<Data | null>;

function AdCard({ ad, act }: { ad: Ad; act: Act }) {
  const [price, setPrice] = useState(String(ad.pricePerClick));
  const [editing, setEditing] = useState(false);
  const [e, setE] = useState({ text: ad.text, href: ad.href, cta: ad.cta ?? "" });
  const [imgError, setImgError] = useState("");
  async function pickImage(file?: File) {
    if (!file) return;
    setImgError("");
    try {
      await act({ action: "uploadImage", id: ad.id, dataUrl: await shrinkImage(file) });
    } catch (err) {
      setImgError(err instanceof Error ? err.message : "שגיאה");
    }
  }
  const reportUrl = typeof location !== "undefined" ? `${location.origin}/report?t=${ad.reportToken}` : "";
  const due = Math.round(ad.clicks * ad.pricePerClick * 100) / 100;
  const btn = "text-xs font-bold rounded-lg px-3 py-1.5";

  return (
    <div className="bg-white rounded-2xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">{ad.business}</div>
          <div className="text-xs text-gray-500">{ad.contact}</div>
        </div>
        <span className={`text-xs font-bold rounded-full px-2 py-1 ${STATUS_STYLE[ad.status]}`}>{STATUS_LABEL[ad.status]}</span>
      </div>

      {/* preview, exactly as players will see it */}
      <div className="rounded-xl overflow-hidden border border-gray-200">
        {ad.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.imageUrl} alt={ad.text} className="w-full h-auto block" referrerPolicy="no-referrer" />
        )}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm font-bold">{ad.text}</span>
          {ad.cta && <span className="text-xs bg-red-600 text-white rounded-full px-3 py-1">{ad.cta}</span>}
        </div>
      </div>
      <a href={ad.href} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="block text-xs text-red-600 underline break-all">{ad.href}</a>

      <div className="flex flex-wrap gap-1 text-xs">
        {PLACEMENTS.map((p: Placement) => (
          <label key={p} className="flex items-center gap-1 border rounded-full px-2 py-1">
            <input
              type="checkbox"
              checked={ad.placements.includes(p)}
              onChange={(e) =>
                act({ action: "update", id: ad.id, placements: e.target.checked ? [...ad.placements, p] : ad.placements.filter((x) => x !== p) })
              }
              className="accent-red-600"
            />
            {PLACEMENT_LABELS[p]}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span>מחיר לכניסה (₪):</span>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" dir="ltr" className="w-20 border rounded-lg px-2 py-1" />
        <button onClick={() => act({ action: "update", id: ad.id, pricePerClick: Number(price) })} className={`${btn} bg-gray-100`}>שמור</button>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-gray-50 rounded-lg p-2"><b className="text-base">{ad.impressions}</b><br />חשיפות</div>
        <div className="bg-gray-50 rounded-lg p-2"><b className="text-base">{ad.clicks}</b><br />כניסות</div>
        <div className="bg-gray-50 rounded-lg p-2"><b className="text-base">{ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0"}%</b><br />CTR</div>
        <div className="bg-green-50 rounded-lg p-2"><b className="text-base text-green-700">{due} ₪</b><br />לתשלום</div>
      </div>

      {editing && (
        <div className="border rounded-xl p-3 space-y-2 bg-gray-50">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={e.text} maxLength={80} onChange={(x) => setE({ ...e, text: x.target.value })} placeholder="כותרת" />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" dir="ltr" value={e.href} onChange={(x) => setE({ ...e, href: x.target.value })} placeholder="קישור יעד https://..." />
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={e.cta} maxLength={16} onChange={(x) => setE({ ...e, cta: x.target.value })} placeholder="טקסט לכפתור" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="bg-red-100 text-red-700 font-bold rounded-lg px-3 py-1.5 cursor-pointer">
              {ad.imageUrl ? "החלף תמונה" : "העלה תמונה"}
              <input type="file" accept="image/*" className="hidden" onChange={(x) => pickImage(x.target.files?.[0])} />
            </label>
            {ad.imageUrl && <button onClick={() => act({ action: "removeImage", id: ad.id })} className="text-gray-500 underline text-xs">הסר תמונה</button>}
          </div>
          {imgError && <p className="text-red-600 text-xs">{imgError}</p>}
          <button
            onClick={async () => { if (await act({ action: "update", id: ad.id, text: e.text, href: e.href, cta: e.cta })) setEditing(false); }}
            className="bg-green-600 text-white font-bold rounded-lg px-4 py-1.5 text-sm"
          >
            שמור שינויים
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setEditing(!editing)} className={`${btn} bg-gray-100`}>{editing ? "סגור עריכה" : "ערוך"}</button>
        {ad.status !== "approved" && <button onClick={() => act({ action: "setStatus", id: ad.id, status: "approved" })} className={`${btn} bg-green-600 text-white`}>אשר</button>}
        {ad.status === "approved" && <button onClick={() => act({ action: "setStatus", id: ad.id, status: "paused" })} className={`${btn} bg-gray-200`}>השהה</button>}
        {ad.status !== "rejected" && <button onClick={() => act({ action: "setStatus", id: ad.id, status: "rejected" })} className={`${btn} bg-red-100 text-red-700`}>דחה</button>}
        <button onClick={() => navigator.clipboard?.writeText(reportUrl)} className={`${btn} bg-red-100 text-red-700`}>העתק קישור דוח למפרסם</button>
        <button onClick={() => confirm("למחוק את הפרסומת?") && act({ action: "delete", id: ad.id })} className={`${btn} text-gray-400`}>מחק</button>
      </div>
    </div>
  );
}

function NewAd({ act }: { act: Act }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ business: "", contact: "-", text: "", href: "", imageUrl: "", cta: "", pricePerClick: "1" });
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm";
  if (!open)
    return <button onClick={() => setOpen(true)} className="w-full bg-white/90 rounded-2xl py-3 font-bold">+ הוספת פרסומת ידנית (עסקה שסגרתי)</button>;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        const d = await act({ action: "create", ...f, pricePerClick: Number(f.pricePerClick) });
        if (!d) return;
        if (file) {
          try {
            const created = d.ads[d.ads.length - 1]; // the new ad is added last
            await act({ action: "uploadImage", id: created.id, dataUrl: await shrinkImage(file) });
          } catch (x) {
            setErr(x instanceof Error ? x.message : "שגיאה בהעלאת התמונה");
            return;
          }
        }
        setOpen(false);
        setFile(null);
        setF({ ...f, business: "", text: "", href: "", imageUrl: "", cta: "" });
      }}
      className="bg-white rounded-2xl p-4 space-y-2"
    >
      <b>פרסומת חדשה (מאושרת מיד)</b>
      <input className={input} placeholder="שם העסק" value={f.business} onChange={set("business")} required />
      <input className={input} placeholder="כותרת" value={f.text} onChange={set("text")} maxLength={80} required />
      <input className={input} placeholder="קישור יעד https://..." value={f.href} onChange={set("href")} dir="ltr" required />
      <label className="flex items-center gap-2 text-sm">
        <span className="bg-red-100 text-red-700 font-bold rounded-lg px-3 py-1.5 cursor-pointer">{file ? "החלף תמונה" : "העלה תמונת באנר (לא חובה)"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(x) => setFile(x.target.files?.[0] ?? null)} />
        {file && <span className="text-xs text-gray-500 truncate">{file.name}</span>}
      </label>
      {err && <p className="text-red-600 text-xs">{err}</p>}
      <input className={input} placeholder="טקסט לכפתור (לא חובה)" value={f.cta} onChange={set("cta")} maxLength={16} />
      <input className={input} placeholder="מחיר לכניסה ב-₪" value={f.pricePerClick} onChange={set("pricePerClick")} inputMode="decimal" dir="ltr" />
      <div className="flex gap-2">
        <button className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg">הוסף</button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 rounded-lg bg-gray-100">ביטול</button>
      </div>
    </form>
  );
}

function StatsCard({ stats }: { stats: StatsSummary | null }) {
  if (!stats)
    return <div className="bg-white rounded-3xl p-5 text-center text-sm text-gray-500">טוען סטטיסטיקה...</div>;
  const tiles = [
    { label: "סה״כ משתמשים", value: stats.total, hint: "מכשירים ייחודיים" },
    { label: "חדשים היום", value: stats.today.new, hint: `אתמול ${stats.yesterday.new}` },
    { label: "פעילים היום", value: stats.today.active, hint: `אתמול ${stats.yesterday.active}` },
    { label: "פעילים ב-7 ימים", value: stats.unique7, hint: "מכשירים שונים" },
    { label: "משחקים היום", value: stats.today.rooms, hint: `אתמול ${stats.yesterday.rooms}` },
    { label: "סה״כ משחקים", value: stats.rooms, hint: "חדרים שנפתחו" },
  ];
  const max = Math.max(1, ...stats.days.map((d) => d.active));
  return (
    <div className="bg-white rounded-3xl p-5 space-y-4">
      <h2 className="text-lg font-extrabold">📊 כמה משתמשים יש לי</h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="bg-red-50 rounded-2xl p-3 text-center">
            <div className="text-3xl font-extrabold text-red-700 tabular-nums">{t.value}</div>
            <div className="text-xs font-bold text-gray-700 leading-tight">{t.label}</div>
            <div className="text-[10px] text-gray-400">{t.hint}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-sm font-bold mb-2">משתמשים פעילים ב-14 הימים האחרונים</div>
        <div className="flex items-end gap-1 h-32 px-1" dir="ltr">
          {stats.days.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.day}: ${d.active} פעילים, ${d.new} חדשים, ${d.rooms} משחקים`}>
              <span className="text-[10px] text-gray-500 tabular-nums">{d.active || ""}</span>
              <div className="w-full rounded-t bg-red-500" style={{ height: `${Math.max(d.active ? 4 : 1, (d.active / max) * 100)}%`, opacity: d.active ? 1 : 0.25 }} />
              <span className="text-[9px] text-gray-400 mt-1">{d.day.slice(8)}/{d.day.slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-400 leading-snug">
        משתמש = מכשיר או דפדפן ייחודי (מזהה אקראי אנונימי, בלי שם או מייל). מי שמשתמש בכמה מכשירים או מנקה את הדפדפן נספר כמה פעמים. הספירה מתחילה מרגע שהתכונה עלתה, והימים לפי שעון ישראל.
      </p>
    </div>
  );
}
