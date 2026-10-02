"use client";
import { useState } from "react";
import { PLACEMENTS, PLACEMENT_LABELS, type Placement } from "@/lib/alias/ads";

export default function AdvertiseForm() {
  const [f, setF] = useState({ business: "", contact: "", text: "", href: "", imageUrl: "", cta: "", website: "" });
  const [places, setPlaces] = useState<Placement[]>([...PLACEMENTS]);
  const [state, setState] = useState<{ error?: string; token?: string; busy?: boolean }>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch("/api/alias/ads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, placements: places }),
      });
      const data = await res.json();
      if (!res.ok) return setState({ error: data.error || "שגיאה" });
      setState({ token: data.reportToken ?? "sent" });
    } catch {
      setState({ error: "שגיאת חיבור" });
    }
  }

  const input = "w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-400";

  if (state.token)
    return (
      <div className="bg-white rounded-3xl p-6 text-center space-y-3">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold">הבקשה התקבלה</h2>
        <p className="text-gray-600 text-sm">הפרסומת תוצג רק אחרי שבעל המשחק יאשר אותה. הוא יחזור אליך בפרטי הקשר שהשארת.</p>
        {state.token !== "sent" && (
          <p className="text-sm">
            דוח חשיפות וכניסות שלך:{" "}
            <a className="text-red-600 underline" href={`/report?t=${state.token}`}>
              לחצו כאן ושמרו את הקישור
            </a>
          </p>
        )}
      </div>
    );

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl p-6 space-y-3">
      <h1 className="text-2xl font-extrabold text-center">לפרסם ב-Alias Games</h1>
      <p className="text-gray-600 text-sm text-center">
        המשחק מציג את הפרסומת לשחקנים, והתשלום הוא לפי כניסות: כל שחקן שנכנס לקישור שלכם דרך המשחק נספר. המחיר נקבע מול בעל המשחק.
      </p>
      <input className={input} placeholder="שם העסק" value={f.business} onChange={set("business")} maxLength={60} required />
      <input className={input} placeholder="טלפון או מייל ליצירת קשר" value={f.contact} onChange={set("contact")} maxLength={80} required />
      <input className={input} placeholder="כותרת הפרסומת (עד 80 תווים)" value={f.text} onChange={set("text")} maxLength={80} required />
      <input className={input} placeholder="קישור שאליו ייכנסו (https://...)" value={f.href} onChange={set("href")} inputMode="url" dir="ltr" required />
      <input className={input} placeholder="קישור לתמונת באנר (לא חובה)" value={f.imageUrl} onChange={set("imageUrl")} inputMode="url" dir="ltr" />
      <input className={input} placeholder="טקסט לכפתור, למשל: להזמנה (לא חובה)" value={f.cta} onChange={set("cta")} maxLength={16} />
      <div className="text-sm">
        <div className="font-bold mb-1">איפה להציג:</div>
        {PLACEMENTS.map((p) => (
          <label key={p} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={places.includes(p)}
              onChange={(e) => setPlaces(e.target.checked ? [...places, p] : places.filter((x) => x !== p))}
              className="w-4 h-4 accent-red-600"
            />
            {PLACEMENT_LABELS[p]}
          </label>
        ))}
      </div>
      {/* honeypot: hidden from people, bots fill it in */}
      <input value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.error && <p className="text-red-600 text-sm text-center">{state.error}</p>}
      <button disabled={state.busy || places.length === 0} className="w-full bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-lg">
        שלחו לאישור
      </button>
    </form>
  );
}
