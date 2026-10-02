"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Report {
  business: string;
  text: string;
  status: string;
  impressions: number;
  clicks: number;
  pricePerClick: number;
  due: number;
}
const STATUS: Record<string, string> = { pending: "ממתינה לאישור", approved: "פעילה", paused: "מושהית", rejected: "נדחתה" };

function ReportInner() {
  const t = useSearchParams().get("t") ?? "";
  const [r, setR] = useState<Report | null | "none">(null);
  useEffect(() => {
    fetch(`/api/alias/ads/report?t=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : "none"))
      .then(setR)
      .catch(() => setR("none"));
  }, [t]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 flex justify-center">
      <div className="w-full max-w-md py-6">
        <div className="bg-white rounded-3xl p-6 space-y-3">
          <h1 className="text-2xl font-extrabold text-center">דוח פרסומת</h1>
          {r === null && <p className="text-center text-gray-500">טוען...</p>}
          {r === "none" && <p className="text-center text-gray-500">הדוח לא נמצא. בדקו את הקישור.</p>}
          {r && r !== "none" && (
            <>
              <p className="text-center text-gray-600">{r.business} · {r.text}</p>
              <p className="text-center text-sm">סטטוס: <b>{STATUS[r.status] ?? r.status}</b></p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-red-50 rounded-2xl p-3"><div className="text-3xl font-extrabold">{r.clicks}</div><div className="text-xs text-gray-500">כניסות לקישור</div></div>
                <div className="bg-red-50 rounded-2xl p-3"><div className="text-3xl font-extrabold">{r.impressions}</div><div className="text-xs text-gray-500">חשיפות</div></div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
                <div className="text-xs text-gray-500">{r.pricePerClick} ₪ לכל כניסה</div>
                <div className="text-3xl font-extrabold text-green-700">{r.due} ₪</div>
                <div className="text-xs text-gray-500">סכום לתשלום עד כה</div>
              </div>
              <p className="text-xs text-gray-400 text-center">כניסה חוזרת של אותו מכשיר לאותה פרסומת בתוך שעה נספרת פעם אחת.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense>
      <ReportInner />
    </Suspense>
  );
}
