"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Crown, Loader2, LogOut, MessageCircle, SkipForward, Trophy, Users, Volume2, VolumeX } from "lucide-react";
import type { AliasView, TeamId } from "@/types/alias";
import Splash from "./Splash";
import ClockTimer from "./ClockTimer";
import YuvalLogo, { YuvalBadge } from "./YuvalLogo";
import { SPECIAL_WORDS, categoryAt, specialSteps } from "@/lib/alias/track";
import { CATEGORY_META } from "@/lib/alias/categories";
import { isMuted, playTick, playTimeUp, setMuted, speak, unlockAudio } from "./sound";
import AdSlot from "./AdSlot";

const TEAM_STYLE = [
  { bg: "bg-rose-700", soft: "bg-rose-50 border-rose-200", text: "text-rose-800", dot: "🔴" },
  { bg: "bg-blue-600", soft: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "🔵" },
  { bg: "bg-green-600", soft: "bg-green-50 border-green-200", text: "text-green-700", dot: "🟢" },
  { bg: "bg-amber-500", soft: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "🟡" },
];
const teamsOf = (view: AliasView) => Array.from({ length: view.teamCount }, (_, i) => i as TeamId);
const STORE_KEY = "alias_session";

type Saved = { code: string; playerId: string; name: string };

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export default function AliasClient() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [ready, setReady] = useState(false);
  const [splash, setSplash] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const [view, setView] = useState<AliasView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0); // serverNow - clientNow

  useEffect(() => {
    // an invite link (?room=1234) wins over a session saved for a different room
    const room = new URLSearchParams(location.search).get("room");
    const stored = loadSaved();
    if (room && /^\d{4}$/.test(room)) {
      setInvite(room);
      setSaved(stored && stored.code === room ? stored : null);
    } else {
      setSaved(stored);
    }
    try {
      if (!sessionStorage.getItem("alias_splash")) setSplash(true);
    } catch {}
    // count this visit for the owner's dashboard: an anonymous random device id, once per browser session
    try {
      if (!sessionStorage.getItem("alias_visit")) {
        let id = localStorage.getItem("alias_vid");
        if (!id) { id = crypto.randomUUID(); localStorage.setItem("alias_vid", id); }
        sessionStorage.setItem("alias_visit", "1");
        fetch("/api/alias/stats/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
    setReady(true);
  }, []);

  // browsers only allow sound after a touch
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  const applyView = useCallback((v: AliasView) => {
    offset.current = v.serverNow - Date.now();
    setView(v);
  }, []);

  const leaveLocal = useCallback(() => {
    try { localStorage.removeItem(STORE_KEY); } catch {}
    setSaved(null);
    setView(null);
  }, []);

  // poll the room
  useEffect(() => {
    if (!saved) return;
    let stop = false;
    let misses = 0;
    async function poll() {
      try {
        const res = await fetch(`/api/alias/rooms/${saved!.code}?p=${saved!.playerId}`, { cache: "no-store" });
        if (stop) return;
        if (res.status === 403) { leaveLocal(); return; }
        // a 404 can be a hiccup (e.g. a request that hit a fresh server), so only leave after several in a row
        if (res.status === 404) { if (++misses >= 5) leaveLocal(); return; }
        if (res.ok) { misses = 0; applyView(await res.json()); }
      } catch { /* transient network error, try again */ }
    }
    poll();
    const id = setInterval(poll, 1200);
    return () => { stop = true; clearInterval(id); };
  }, [saved, applyView, leaveLocal]);

  // keep the phone awake during an active round
  const playing = view?.phase === "playing";
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [playing]);

  // local clock for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  async function enter(code: string, playerId: string, name: string, v: AliasView) {
    const s = { code, playerId, name };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
    applyView(v);
    setSaved(s);
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/alias/rooms/${saved.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, playerId: saved.playerId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "שגיאה"); return; }
      if (data.left) { leaveLocal(); return; }
      if (action === "leave") { leaveLocal(); return; }
      applyView(data.view);
    } catch {
      setError("שגיאת חיבור");
    } finally {
      setBusy(false);
    }
  }

  const closeSplash = useCallback(() => {
    try { sessionStorage.setItem("alias_splash", "1"); } catch {}
    setSplash(false);
  }, []);

  if (!ready) return null;
  if (splash) return <Splash onDone={closeSplash} />;
  if (!saved || !view) {
    if (saved && !view) {
      return (
        <Shell>
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
        </Shell>
      );
    }
    return <Home onEnter={enter} inviteCode={invite} />;
  }

  const msLeft = view.endsAt ? Math.max(0, view.endsAt - (now + offset.current)) : 0;
  const secondsLeft = Math.ceil(msLeft / 1000);

  return (
    <Shell>
      <Room view={view} secondsLeft={secondsLeft} msLeft={msLeft} busy={busy} error={error} act={act} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] app-bg p-4 flex justify-center"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md flex flex-col" style={{ minHeight: "calc(100dvh - 2rem)" }}>
        <div>{children}</div>
        <Credit />
      </div>
    </div>
  );
}

// permanent credit at the bottom of every screen
function Credit() {
  return (
    <footer className="mt-auto pt-8 pb-2 text-center text-sm text-brand-100">
      פותח ע״י <span className="font-bold text-white">גיל בן יהודה</span>
      <a href="mailto:gilbeny@gmail.com" dir="ltr" className="block text-xs text-brand-100 underline mt-0.5">
        gilbeny@gmail.com
      </a>
    </footer>
  );
}

// ───────────────────────── Home: create / join ─────────────────────────
function Home({ onEnter, inviteCode }: { onEnter: (code: string, playerId: string, name: string, v: AliasView) => void; inviteCode: string | null }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(inviteCode ?? "");
  const [createPw, setCreatePw] = useState("");
  const [joinPw, setJoinPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showRules, setShowRules] = useState(false);

  async function go(mode: "create" | "join") {
    setError("");
    if (!name.trim()) return setError("הכניסו שם");
    if (mode === "join" && code.length !== 4) return setError("קוד חדר הוא 4 ספרות");
    setLoading(true);
    try {
      const res = await fetch(mode === "create" ? "/api/alias/rooms" : `/api/alias/rooms/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name: name.trim(), password: mode === "create" ? createPw : joinPw }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "שגיאה");
      onEnter(data.code, data.playerId, name.trim(), data.view);
    } catch {
      setError("שגיאת חיבור");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="pt-6 mb-5">
        <YuvalLogo size={230} />
      </div>
      <button
        onClick={() => setShowRules(true)}
        className="w-full mb-4 bg-white/15 hover:bg-white/25 border border-white/40 text-white font-bold py-3 rounded-2xl text-lg"
      >
        📖 חוקי המשחק והסבר
      </button>
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-4">
        {inviteCode && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm text-center">
            הוזמנת לחדר <b className="tracking-widest">{inviteCode}</b> 🎉 הכניסו שם (ואת הסיסמה, אם יש) ולחצו הצטרף
          </div>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="השם שלך"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          type="password"
          value={createPw}
          onChange={(e) => setCreatePw(e.target.value)}
          maxLength={30}
          autoComplete="new-password"
          placeholder="🔒 סיסמה לחדר (לא חובה)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          onClick={() => go("create")}
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-lg"
        >
          צור משחק חדש
        </button>
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="flex-1 h-px bg-gray-200" /> או <div className="flex-1 h-px bg-gray-200" />
        </div>
        <input
          type="password"
          value={joinPw}
          onChange={(e) => setJoinPw(e.target.value)}
          maxLength={30}
          autoComplete="off"
          placeholder="🔒 סיסמה (אם החדר מוגן)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="קוד חדר"
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            onClick={() => go("join")}
            disabled={loading}
            className="bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold px-6 rounded-xl"
          >
            הצטרף
          </button>
        </div>
        {error && <p className="text-rose-600 text-sm text-center">{error}</p>}
      </div>
      <div className="mt-4"><AdSlot placement="home" /></div>
    </Shell>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ["🎯 מטרת המשחק", "להיות הקבוצה הראשונה שמגיעה לגביע 🏆 בסוף הנהר."],
    ["👥 קבוצות", "משחקים 2 עד 4 קבוצות, לפחות שחקן אחד בכל קבוצה. יוצרים חדר, שולחים את הקוד (או קישור וואטסאפ) לחברים, וכולם מצטרפים מהטלפון."],
    ["🪨 הלוח", "כולם מתחילים באבן הראשונה. כל אבן שייכת לקטגוריה לפי הצבע והאייקון שלה, והמילה שמסבירים נלקחת מהקטגוריה של האבן שבה הקבוצה עומדת."],
    ["🗣️ התור", "בכל תור מסביר אחד מהקבוצה מסביר מילה אחת בכל פעם, בלי להגיד אותה, בלי מילים מאותו שורש ובלי תרגום. חברי הקבוצה מנחשים בקול, והזמן מוגבל בשעון."],
    ["✅ ניקוד", "מילה שנוחשה = לוחצים \"נחשו\" והקבוצה מתקדמת אבן קדימה. דילוג מחזיר אבן אחורה (אפשר לכבות בהגדרות)."],
    ["🔔 סוף הזמן", "ב-5 השניות האחרונות נשמעים צלצולים, ובסוף הסיבוב המסביר יכול לתקן מילים שסומנו בטעות."],
    ["⭐ אבני כוכב", "קבוצה שנוחתת על אבן כוכב מקבלת סיבוב פנטומימה בתור הבא שלה: בלי מילים ובלי טיימר, המסביר מראה בתנועות 4 מילים, כל הקבוצות מנחשות, והקבוצה שניחשה ראשונה מתקדמת."],
    ["🔁 מי מסביר", "אי אפשר לדלג על תור של קבוצה. אפשר רק להחליף את המסביר בתוך אותה קבוצה."],
    ["🏆 ניצחון", "הראשונה שמגיעה לאבן האחרונה מנצחת. אפשר להתחיל משחק חוזר באותו חדר."],
  ];
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={onClose} role="dialog" aria-modal="true" aria-label="חוקי המשחק">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-extrabold text-brand-700 text-center mb-3">חוקי המשחק</h2>
        <div className="space-y-3">
          {items.map(([t, d]) => (
            <div key={t}>
              <p className="font-bold text-gray-900">{t}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-5 w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl">הבנתי, בואו נשחק</button>
      </div>
    </div>
  );
}

// ───────────────────────── Room ─────────────────────────
type ActFn = (action: string, extra?: Record<string, unknown>) => Promise<void>;

function Room({ view, secondsLeft, msLeft, busy, error, act }: { view: AliasView; secondsLeft: number; msLeft: number; busy: boolean; error: string; act: ActFn }) {
  const isHost = view.me?.id === view.hostId;
  const isExplainer = view.me?.id === view.explainerId;
  const explainer = view.players.find((p) => p.id === view.explainerId);
  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);

  // The last 5 seconds tick (5,4,3,2,1, each more urgent), and a buzzer at 0. Played on every
  // player's phone, driven by the same server clock as the hourglass.
  const lastTick = useRef("");
  const buzzed = useRef("");
  useEffect(() => {
    if (view.phase !== "playing") return;
    const key = `${view.code}:${view.turn}`;
    if (secondsLeft >= 1 && secondsLeft <= 5 && lastTick.current !== `${key}:${secondsLeft}`) {
      lastTick.current = `${key}:${secondsLeft}`;
      playTick(secondsLeft);
    }
    if (secondsLeft === 0 && view.endsAt && buzzed.current !== key) {
      buzzed.current = key;
      playTimeUp();
    }
  }, [view.phase, view.code, view.turn, view.endsAt, secondsLeft]);

  // Announce out loud whose turn it is, once per turn, on every phone
  const announced = useRef("");
  useEffect(() => {
    if (view.phase !== "ready") return;
    const key = `${view.code}:${view.turn}`;
    if (announced.current === key) return;
    announced.current = key;
    const name = view.teamNames[view.activeTeam];
    speak(view.specialTurn != null ? `סיבוב פנטומימה של ${name}` : `התור של ${name}`);
  }, [view.phase, view.code, view.turn, view.activeTeam, view.teamNames, view.specialTurn]);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between text-white pt-2">
        <div className="text-white"><YuvalBadge /></div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { unlockAudio(); setMuted(!muted); setMutedState(!muted); }}
            className="p-2 bg-white/10 rounded-lg"
            aria-label={muted ? "הפעלת צליל" : "השתקה"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <CodeChip code={view.code} hasPassword={view.hasPassword} />
          <button
            onClick={() => confirm("לצאת מהמשחק?") && act("leave")}
            className="p-2 bg-white/10 rounded-lg"
            aria-label="יציאה"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view.phase !== "lobby" && <Scoreboard view={view} />}

      <div className="bg-white rounded-3xl shadow-2xl p-5">
        {view.phase === "lobby" && <Lobby view={view} isHost={isHost} act={act} busy={busy} />}

        {view.phase === "ready" && (
          <Centered>
            <TeamBadge view={view} team={view.activeTeam} />
            {view.specialTurn != null ? (
              // this turn is the team's mime round (they landed on a star stone last turn)
              isExplainer ? (
                <>
                  <span className="inline-block bg-amber-400 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full">⭐ סיבוב פנטומימה</span>
                  <h2 className="text-2xl font-bold">התור שלך להציג!</h2>
                  <CategoryChip id={view.specialTurn} />
                  <p className="text-gray-500 text-sm">
                    הקבוצה נחתה בתור הקודם על אבן עם כוכב, ולכן התור הזה הוא סיבוב פנטומימה במקום סיבוב רגיל: בלי טיימר ו<b>בלי לדבר</b>!
                    מציגים {SPECIAL_WORDS} מילים בתנועות בלבד, וכל הקבוצות מנחשות.
                  </p>
                  <BigButton onClick={() => act("begin")} disabled={busy} color="bg-amber-500">התחל סיבוב פנטומימה</BigButton>
                </>
              ) : (
                <>
                  <span className="inline-block bg-amber-400 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full">⭐ סיבוב פנטומימה</span>
                  <h2 className="text-2xl font-bold">{explainer?.name ?? "..."} מציג/ה</h2>
                  <CategoryChip id={view.specialTurn} />
                  <p className="text-gray-500 text-sm">
                    {view.teamNames[view.activeTeam]} נחתו על אבן עם כוכב: סיבוב פנטומימה! בלי מילים, וכל הקבוצות מנחשות {SPECIAL_WORDS} מילים. היו מוכנים.
                  </p>
                </>
              )
            ) : isExplainer ? (
              <>
                <h2 className="text-2xl font-bold">התור שלך להסביר!</h2>
                <CategoryChip id={view.category} big />
                <p className="text-gray-500 text-sm">
                  הקבוצה עומדת על אבן מהקטגוריה הזו, ולכן המילים יהיו משם. בלי להגיד את המילה עצמה. יש לכם {view.roundSeconds} שניות.
                </p>
                <BigButton onClick={() => act("begin")} disabled={busy} color="bg-green-600">התחל סיבוב</BigButton>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">{explainer?.name ?? "..."} מסביר/ה</h2>
                <CategoryChip id={view.category} />
                <p className="text-gray-500 text-sm">
                  {view.me?.team === view.activeTeam
                    ? "אתם הקבוצה המנחשת, היו מוכנים!"
                    : "הקבוצה שלכם צופה. אפשר לוודא שלא מרמים 😉"}
                </p>
              </>
            )}
            <ExplainerPicker view={view} act={act} busy={busy} />
          </Centered>
        )}

        {view.phase === "playing" && (
          <Centered>
            <TeamBadge view={view} team={view.activeTeam} />
            <div className="flex items-center gap-5">
              {/* key restarts the clock when a new turn starts; elapsed keeps it in step with the server clock */}
              <ClockTimer key={view.turn} seconds={view.roundSeconds} size={84} elapsed={view.roundSeconds - msLeft / 1000} urgent={secondsLeft > 0 && secondsLeft <= 5} />
              <div className={`text-6xl font-extrabold tabular-nums ${secondsLeft <= 10 ? "text-rose-600" : "text-gray-800"}`}>
                {secondsLeft}
              </div>
            </div>
            {isExplainer && view.word ? (
              <>
                <WordCard word={view.word} category={view.category} />
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => act("skip")}
                    disabled={busy}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-lg"
                  >
                    <SkipForward className="w-5 h-5" /> דלג{view.skipPenalty ? " (צעד אחורה)" : ""}
                  </button>
                  <button
                    onClick={() => act("correct")}
                    disabled={busy}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-lg"
                  >
                    <Check className="w-5 h-5" /> נוחש (+1)
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  ניחשו: {view.correctCount} · דילגתם: {view.skipCount}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">{explainer?.name} מסביר/ה...</h2>
                <p className="text-gray-500 text-sm">
                  {view.me?.team === view.activeTeam ? "נחשו בקול! 🎯" : "הקבוצה השנייה מנחשת. אתם השופטים 👀"}
                </p>
                {view.isReferee && view.word && (
                  <div className="w-full space-y-2">
                    <p className="text-xs font-bold text-orange-600">
                      מצב שופט: רק אתם רואים את המילה. ודאו שהמסביר לא מרמה ושהחבר שלו ענה נכון!
                    </p>
                    <WordCard word={view.word} category={view.category} />
                    <div className="flex flex-wrap gap-1 justify-center">
                      {view.results.map((r, i) => (
                        <span key={i} className={`text-xs px-2 py-1 rounded-full ${r.ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500 line-through"}`}>
                          {r.ok ? "✅" : "⏭️"} {r.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Centered>
        )}

        {view.phase === "roundEnd" && (
          <div className="space-y-4">
            <div className="text-center">
              <TeamBadge view={view} team={view.activeTeam} />
              <h2 className="text-2xl font-bold mt-2">נגמר הזמן!</h2>
              <p className="text-3xl font-extrabold mt-1">
                {view.roundScore > 0 ? "+" : ""}{view.roundScore} צעדים
              </p>
            </div>
            <ul className="divide-y border rounded-xl max-h-64 overflow-y-auto">
              {view.results.length === 0 && <li className="p-3 text-center text-gray-400 text-sm">לא היו מילים</li>}
              {view.results.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className={r.ok ? "text-gray-800" : "text-gray-400 line-through"}>{r.word}</span>
                  {isExplainer ? (
                    <button
                      onClick={() => act("toggle", { index: i })}
                      disabled={busy}
                      className={`text-xs px-3 py-1 rounded-full ${r.ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {r.ok ? "נוחש ✓" : "דולג"}
                    </button>
                  ) : (
                    <span className="text-xs">{r.ok ? "✅" : "⏭️"}</span>
                  )}
                </li>
              ))}
            </ul>
            {isExplainer && <p className="text-xs text-gray-400 text-center">אפשר ללחוץ על מילה כדי לתקן את התוצאה</p>}
            {isExplainer || isHost ? (
              <BigButton onClick={() => act("next")} disabled={busy} color="bg-brand-600">אישור והמשך</BigButton>
            ) : (
              <p className="text-center text-gray-500 text-sm">ממתינים ל{explainer?.name ?? "המסביר"}...</p>
            )}
          </div>
        )}

        {view.phase === "special" && view.special && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <span className="inline-block bg-amber-400 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full">⭐ סיבוב פנטומימה</span>
              <h2 className="text-xl font-bold">סיבוב הפנטומימה של {view.teamNames[view.special.team]}</h2>
              <p className="text-sm text-gray-500">
                בלי הגבלת זמן, ו<b>בלי לדבר</b>: {explainer?.name} מציג/ה {view.special.total} מילים בתנועות בלבד, וכל הקבוצות מנחשות.
                הקבוצה שמנחשת ראשונה מקבלת אבן קדימה.
              </p>
            </div>

            <div className="flex justify-center gap-2" aria-label="התקדמות הסיבוב המיוחד">
              {Array.from({ length: view.special.total }, (_, i) => {
                const award = view.special!.awards[i];
                const done = i < view.special!.awards.length;
                return (
                  <span
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      done
                        ? award === null || award === undefined
                          ? "bg-gray-200 border-gray-300 text-gray-500"
                          : `${TEAM_STYLE[award].bg} border-white text-white`
                        : i === view.special!.index
                          ? "border-brand-500 text-brand-600 bg-white"
                          : "border-gray-200 text-gray-300 bg-white"
                    }`}
                  >
                    {done ? (award === null || award === undefined ? "✕" : "✓") : i + 1}
                  </span>
                );
              })}
            </div>
            <p className="text-center text-sm font-bold">מילה {view.special.index + 1} מתוך {view.special.total}</p>

            {isExplainer && view.word ? (
              <>
                <WordCard word={view.word} category={view.special.category} mime />
                <p className="text-center text-sm text-gray-600">איזו קבוצה ניחשה ראשונה?</p>
                <div className="grid grid-cols-2 gap-2">
                  {teamsOf(view).map((t) => (
                    <button
                      key={t}
                      onClick={() => act("award", { team: t })}
                      disabled={busy}
                      className={`${TEAM_STYLE[t].bg} text-white font-bold py-3 rounded-xl truncate px-2`}
                    >
                      {view.teamNames[t]} (+1)
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => act("award", { team: null })}
                  disabled={busy}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl"
                >
                  אף קבוצה לא ניחשה
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2"><CategoryChip id={view.special.category} /><p className="text-center text-gray-500 text-sm">{explainer?.name} מציג/ה בלי מילים... כולם מנחשים בקול! 🎯</p></div>
            )}
          </div>
        )}

        {view.phase === "finished" && view.winner !== null && (
          <Centered>
            <Trophy className="w-14 h-14 text-yellow-500" />
            <h2 className="text-3xl font-extrabold">
              {TEAM_STYLE[view.winner].dot} {view.teamNames[view.winner]} ניצחו!
            </h2>
            <p className="text-gray-500">
              {teamsOf(view).map((t) => view.scores[t]).join(" : ")}
            </p>
            {isHost ? (
              <BigButton onClick={() => act("rematch")} disabled={busy} color="bg-brand-600">משחק חדש</BigButton>
            ) : (
              <p className="text-sm text-gray-400">ממתינים שהמארח יתחיל משחק חדש</p>
            )}
          </Centered>
        )}
      </div>

      {(view.phase === "lobby" || view.phase === "roundEnd" || view.phase === "finished") && (
        <AdSlot placement={view.phase === "lobby" ? "lobby" : "roundEnd"} />
      )}

      {view.phase !== "lobby" && <Board view={view} />}

      {error && <p className="text-center text-sm bg-white/90 text-rose-600 rounded-xl py-2">{error}</p>}

      {view.phase !== "lobby" && view.phase !== "finished" && <Players view={view} compact />}
    </div>
  );
}

function Lobby({ view, isHost, act, busy }: { view: AliasView; isHost: boolean; act: ActFn; busy: boolean }) {
  const canStart = teamsOf(view).every((t) => view.players.filter((p) => p.team === t).length >= 2);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-center">חדר {view.code}</h2>
      <p className="text-center text-gray-500 text-sm">
        שתפו את הקוד עם החברים. צריך לפחות 2 שחקנים בכל קבוצה. אפשר ללחוץ על שם הקבוצה כדי לשנות אותו.
      </p>
      <WhatsAppInvite code={view.code} hasPassword={view.hasPassword} />
      <Players view={view} act={act} />

      {isHost ? (
        <PasswordBox hasPassword={view.hasPassword} onSave={(password) => act("setPassword", { password })} busy={busy} />
      ) : (
        <p className="text-center text-xs text-gray-500">{view.hasPassword ? "🔒 החדר מוגן בסיסמה" : "החדר פתוח לכל מי שיש לו את הקוד"}</p>
      )}

      {isHost ? (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            מספר קבוצות
            <span className="flex gap-1">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => act("settings", { teamCount: n })}
                  className={`w-10 h-9 rounded-lg font-bold border-2 ${
                    view.teamCount === n ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
          <label className="flex items-center justify-between text-sm">
            אורך הלוח (משבצות)
            <Stepper value={view.targetScore} step={5} min={20} max={100} onChange={(v) => act("settings", { targetScore: v })} />
          </label>
          <label className="flex items-center justify-between text-sm">
            שניות לסיבוב
            <Stepper value={view.roundSeconds} step={10} min={20} max={180} onChange={(v) => act("settings", { roundSeconds: v })} />
          </label>
          <label className="flex items-center justify-between text-sm">
            דילוג מחזיר צעד אחורה
            <input
              type="checkbox"
              checked={view.skipPenalty}
              onChange={(e) => act("settings", { skipPenalty: e.target.checked })}
              className="w-5 h-5 accent-brand-600"
            />
          </label>
          <BigButton onClick={() => act("start")} disabled={busy || !canStart} color="bg-green-600">
            התחילו משחק
          </BigButton>
        </div>
      ) : (
        <p className="text-center text-gray-500 text-sm border-t pt-4">
          {view.teamCount} קבוצות · אורך הלוח: {view.targetScore} משבצות · {view.roundSeconds} שניות לתור
          <br />
          ממתינים שהמארח יתחיל...
        </p>
      )}
    </div>
  );
}

// Host only: set, change or remove the room password
function PasswordBox({ hasPassword, onSave, busy }: { hasPassword: boolean; onSave: (pw: string) => void; busy: boolean }) {
  const [pw, setPw] = useState("");
  return (
    <div className="border rounded-xl p-3 space-y-2">
      <div className="text-sm font-bold">{hasPassword ? "🔒 החדר מוגן בסיסמה" : "🔓 החדר פתוח לכל מי שיש לו את הקוד"}</div>
      <div className="flex gap-2">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          maxLength={30}
          autoComplete="new-password"
          placeholder={hasPassword ? "סיסמה חדשה" : "קבעו סיסמה"}
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          disabled={busy || (!pw && !hasPassword)}
          onClick={() => { onSave(pw); setPw(""); }}
          className="bg-brand-600 disabled:opacity-40 text-white text-sm font-bold px-3 rounded-lg"
        >
          {pw ? "שמור" : "הסר"}
        </button>
      </div>
    </div>
  );
}

function Players({ view, act, compact }: { view: AliasView; act?: ActFn; compact?: boolean }) {
  return (
    <div className={compact ? "bg-white/10 rounded-2xl p-3 text-white" : ""}>
      <div className="grid grid-cols-2 gap-3">
        {teamsOf(view).map((t) => (
          <div key={t} className={compact ? "" : `border rounded-2xl p-3 ${TEAM_STYLE[t].soft}`}>
            <div className={`text-sm font-bold mb-2 flex items-center gap-1 ${compact ? "text-white" : TEAM_STYLE[t].text}`}>
              <Users className="w-4 h-4 shrink-0" />
              <TeamName
                name={view.teamNames[t]}
                editable={!!act && (view.me?.id === view.hostId || view.me?.team === t)}
                onSave={(name) => act!("renameTeam", { team: t, name })}
              />
            </div>
            <ul className="space-y-1">
              {view.players.filter((p) => p.team === t).map((p) => (
                <li key={p.id} className={`text-sm flex items-center gap-1 ${compact ? "" : "text-gray-800"}`}>
                  {p.id === view.hostId && <Crown className="w-3 h-3 text-yellow-500" />}
                  {p.id === view.explainerId && <span>🗣️</span>}
                  <span className={p.id === view.me?.id ? "font-bold" : ""}>{p.name}</span>
                </li>
              ))}
            </ul>
            {act && view.me && view.me.team !== t && (
              <button
                onClick={() => act("setTeam", { team: t })}
                className="mt-2 text-xs underline text-gray-500"
              >
                עבור לקבוצה הזו
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Scoreboard({ view }: { view: AliasView }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${view.teamCount}, minmax(0, 1fr))` }}>
      {teamsOf(view).map((t) => (
        <div
          key={t}
          className={`${TEAM_STYLE[t].bg} text-white rounded-2xl p-2 text-center border-2 border-white/50 ${
            view.activeTeam === t && view.phase !== "finished" ? "ring-4 ring-white" : "opacity-80"
          }`}
        >
          <div className="text-xs truncate">{view.teamNames[t]}</div>
          <div className="text-3xl font-extrabold">{view.scores[t]}</div>
          <div className="text-[10px] opacity-80">מתוך {view.targetScore}</div>
          {view.specialPending?.[t] != null && <div className="text-[10px] font-bold text-yellow-200">⭐ פנטומימה בתור הבא</div>}
        </div>
      ))}
    </div>
  );
}

// The category of a stone: its icon and name on the category's colour
function CategoryChip({ id, big }: { id: number; big?: boolean }) {
  const c = CATEGORY_META[id];
  return (
    <span
      className={`inline-flex items-center gap-2 font-bold text-white rounded-full shadow ${big ? "px-6 py-3 text-xl" : "px-3 py-1 text-xs"}`}
      style={{ backgroundColor: c.color }}
    >
      <span className={big ? "text-3xl" : ""}>{c.icon}</span>
      {c.name}
    </span>
  );
}

// The word to explain, on a card in the category's colour
function WordCard({ word, category, mime }: { word: string; category: number; mime?: boolean }) {
  const c = CATEGORY_META[category];
  return (
    <div className="w-full rounded-3xl overflow-hidden border-4 shadow-md" style={{ borderColor: c.color }}>
      <div className="px-4 py-2 text-white text-sm font-bold text-center" style={{ backgroundColor: c.color }}>
        {c.icon} {c.name}
        {mime ? " · פנטומימה, בלי לדבר!" : ""}
      </div>
      <div className="bg-white py-9 px-3 text-center">
        <span className="text-4xl font-extrabold text-gray-900 break-words">{word}</span>
      </div>
    </div>
  );
}

// ── The board: a winding river of stepping stones, each stone coloured by the category of its word ──
// Everybody starts on the first stone; the trophy is on the last one. Star stones = silent mime rounds.
const BOARD_W = 360;
const BOARD_PAD = 14;
const COLS = 7;
const CELL = (BOARD_W - 2 * BOARD_PAD) / COLS;
const TILE = CELL - 8;

type Pt = { x: number; y: number };

// stone i (0 = start, count = trophy), snaking left→right then right→left row by row
function trackPoints(count: number): { pts: Pt[]; height: number } {
  const rows = Math.ceil((count + 1) / COLS);
  const pts: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const r = Math.floor(i / COLS);
    const c = r % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
    pts.push({ x: BOARD_PAD + CELL * (c + 0.5), y: BOARD_PAD + CELL * (r + 0.5) });
  }
  return { pts, height: 2 * BOARD_PAD + rows * CELL };
}

const TEAM_PAWN = ["#be123c", "#2563eb", "#16a34a", "#f59e0b"];
const PAWN_CORNER = [[11, -11], [-11, -11], [11, 11], [-11, 11]];

function Board({ view }: { view: AliasView }) {
  const total = view.targetScore;
  const { pts, height } = useMemo(() => trackPoints(total), [total]);
  const teams = teamsOf(view);
  const specials = useMemo(() => new Set(specialSteps(total)), [total]);

  return (
    <div className="bg-white/10 rounded-2xl p-2 shadow-lg">
      <svg viewBox={`0 0 ${BOARD_W} ${height}`} className="w-full h-auto" role="img" aria-label="לוח המשחק">
        <defs>
          <linearGradient id="boardGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#312e81" />
            <stop offset="1" stopColor="#4c1d95" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={BOARD_W} height={height} rx="16" fill="url(#boardGlow)" stroke="#ddd6fe" strokeOpacity="0.5" strokeWidth="2" />

        {/* the river the stones sit in */}
        <polyline points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth={TILE * 0.8} strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => {
          const x = p.x - TILE / 2;
          const y = p.y - TILE / 2;
          if (i === total) {
            return (
              <g key={i}>
                <rect x={x} y={y} width={TILE} height={TILE} rx="12" fill="#fde047" stroke="#fff" strokeWidth="3" />
                <text x={p.x} y={p.y + 8} textAnchor="middle" fontSize="24">🏆</text>
              </g>
            );
          }
          if (i === 0) {
            return (
              <g key={i}>
                <rect x={x} y={y} width={TILE} height={TILE} rx="12" fill="#16a34a" stroke="#fff" strokeWidth="3" />
                <text x={p.x} y={p.y + 15} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">התחלה</text>
              </g>
            );
          }
          const c = CATEGORY_META[categoryAt(i)];
          const star = specials.has(i);
          return (
            <g key={i}>
              <rect x={x} y={y} width={TILE} height={TILE} rx="10" fill={c.color} stroke={star ? "#fde047" : "#fff"} strokeOpacity={star ? 1 : 0.55} strokeWidth={star ? 3.5 : 1.5} />
              <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="18">{c.icon}</text>
              {star && <text x={p.x + TILE / 2 - 4} y={p.y - TILE / 2 + 9} textAnchor="middle" fontSize="13">⭐</text>}
            </g>
          );
        })}

        {/* the teams' pawns sit in the corners of their stone */}
        {teams.map((t) => {
          const p = pts[Math.min(view.scores[t], total)];
          const [dx, dy] = PAWN_CORNER[t];
          return (
            <g key={t} style={{ transform: `translate(${p.x + dx}px, ${p.y + dy}px)`, transition: "transform 0.9s ease-in-out" }}>
              <circle r="7" fill={TEAM_PAWN[t]} stroke="#fff" strokeWidth="2.5" />
              {view.activeTeam === t && view.phase !== "finished" && (
                <circle r="11" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="3 3" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-1 mt-2">
        {CATEGORY_META.map((c) => <CategoryChip key={c.id} id={c.id} />)}
      </div>
      <p className="text-[11px] text-white/90 mt-2 text-center px-2">
        כל אבן על הנהר היא קטגוריה — המילה לפי צבע האבן שבה עומדת הקבוצה. כל מילה שנוחשה מקדמת אבן{view.skipPenalty ? ", וכל דילוג מחזיר אבן אחורה" : ""}.
        ⭐ אבן כוכב = סיבוב פנטומימה: בלי מילים ובלי טיימר, כל הקבוצות מנחשות.
        הראשונה שמגיעה לגביע מנצחת.
      </p>
    </div>
  );
}

function TeamBadge({ view, team }: { view: AliasView; team: TeamId }) {
  return (
    <span className={`inline-block text-xs font-bold text-white px-3 py-1 rounded-full ${TEAM_STYLE[team].bg}`}>
      התור של {view.teamNames[team]}
    </span>
  );
}

// "Change the explainer": only to another player of the SAME team (nobody can skip a team's turn)
function ExplainerPicker({ view, act, busy }: { view: AliasView; act: ActFn; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const mine = view.me?.id === view.hostId || view.me?.team === view.activeTeam;
  const mates = view.players.filter((p) => p.team === view.activeTeam && p.id !== view.explainerId);
  if (!mine || mates.length === 0) return null;
  return (
    <div className="w-full text-center">
      <button onClick={() => setOpen(!open)} className="text-xs text-gray-500 underline">
        {open ? "סגור" : "להחליף את המסביר בשחקן אחר מהקבוצה?"}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {mates.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => { act("setExplainer", { target: p.id }); setOpen(false); }}
              className={`${TEAM_STYLE[view.activeTeam].bg} text-white text-sm font-bold rounded-full px-4 py-1.5`}
            >
              {p.name} יסביר/ה
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Team name: plain text, or an inline-editable field in the lobby
function TeamName({ name, editable, onSave }: { name: string; editable: boolean; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(name);
  }, [name, focused]);
  if (!editable) return <span className="truncate">{name}</span>;
  return (
    <input
      value={draft}
      maxLength={16}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const v = draft.trim();
        if (v && v !== name) onSave(v);
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      aria-label="שם הקבוצה"
      className="min-w-0 w-full bg-transparent border-b border-dashed border-current font-bold focus:outline-none"
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center text-center gap-4 py-2">{children}</div>;
}

function BigButton({ children, color, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { color: string }) {
  return (
    <button {...rest} className={`w-full ${color} hover:opacity-90 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-lg`}>
      {children}
    </button>
  );
}

function Stepper({ value, step, min, max, onChange }: { value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <span className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - step))} className="w-8 h-8 rounded-full bg-gray-100 font-bold">−</button>
      <span className="w-10 text-center font-bold">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} className="w-8 h-8 rounded-full bg-gray-100 font-bold">+</button>
    </span>
  );
}

// Invite text + link; the link carries only the room code, never the password
function inviteText(code: string, hasPassword: boolean) {
  const url = `${location.origin}/?room=${code}`;
  return `בואו לשחק איתי ביובל! 🗣️\nקוד חדר: ${code}\n${url}${hasPassword ? "\n(החדר מוגן בסיסמה, הסיסמה אצלי)" : ""}`;
}

function WhatsAppInvite({ code, hasPassword }: { code: string; hasPassword: boolean }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(inviteText(code, hasPassword))}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:opacity-90 text-white font-bold py-3 rounded-xl text-lg"
    >
      <MessageCircle className="w-6 h-6" />
      הזמינו חברים בוואטסאפ
    </a>
  );
}

function CodeChip({ code, hasPassword }: { code: string; hasPassword: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(inviteText(code, hasPassword)).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex items-center gap-1 bg-white/10 px-3 py-2 rounded-lg text-sm font-mono tracking-widest"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {code}
    </button>
  );
}
