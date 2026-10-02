"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Crown, Loader2, LogOut, MessageCircle, SkipForward, Trophy, Users, Volume2, VolumeX } from "lucide-react";
import type { AliasView, TeamId } from "@/types/alias";
import Splash, { Hourglass } from "./Splash";
import AliasLogo, { AliasBadge } from "./AliasLogo";
import AdSlot from "./AdSlot";
import Dice, { isMuted, resetDice, setMuted, unlockAudio } from "./Dice";

const TEAM_STYLE = [
  { bg: "bg-red-800", soft: "bg-red-50 border-red-200", text: "text-red-800", dot: "🔴" },
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
    setReady(true);
  }, []);

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
    resetDice();
    setSaved(null);
    setView(null);
  }, []);

  // poll the room
  useEffect(() => {
    if (!saved) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/alias/rooms/${saved!.code}?p=${saved!.playerId}`, { cache: "no-store" });
        if (stop) return;
        if (res.status === 404 || res.status === 403) { leaveLocal(); return; }
        if (res.ok) applyView(await res.json());
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
      className="min-h-[100dvh] bg-gradient-to-br from-red-500 via-red-600 to-red-700 p-4 flex justify-center"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
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
        <AliasLogo size={230} />
      </div>
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
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <input
          type="password"
          value={createPw}
          onChange={(e) => setCreatePw(e.target.value)}
          maxLength={30}
          autoComplete="new-password"
          placeholder="🔒 סיסמה לחדר (לא חובה)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          onClick={() => go("create")}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-lg"
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
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="קוד חדר"
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-3 text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            onClick={() => go("join")}
            disabled={loading}
            className="bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold px-6 rounded-xl"
          >
            הצטרף
          </button>
        </div>
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      </div>
      <div className="mt-4"><AdSlot placement="home" /></div>
    </Shell>
  );
}

// ───────────────────────── Room ─────────────────────────
type ActFn = (action: string, extra?: Record<string, unknown>) => Promise<void>;

function Room({ view, secondsLeft, msLeft, busy, error, act }: { view: AliasView; secondsLeft: number; msLeft: number; busy: boolean; error: string; act: ActFn }) {
  const isHost = view.me?.id === view.hostId;
  const isExplainer = view.me?.id === view.explainerId;
  const explainer = view.players.find((p) => p.id === view.explainerId);
  const [settled, setSettled] = useState("");
  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);
  const rollKey = `${view.code}:${view.rollId}`;
  // with the dice, the explainer sees the word only after the die has landed
  const revealed = !view.useDice || settled === rollKey;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between text-white pt-2">
        <div className="text-white"><AliasBadge /></div>
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
            {isExplainer ? (
              <>
                <h2 className="text-2xl font-bold">התור שלך להסביר!</h2>
                <p className="text-gray-500 text-sm">
                  {view.useDice
                    ? "לכל מילה תוטל קובייה, והמספר שיצא קובע איזו מילה מהקלף להסביר. "
                    : `הקבוצה על משבצת ${view.slot}, אז תסבירו את המילה מספר ${view.slot} בכל קלף. `}
                  בלי להגיד את המילה עצמה. יש לכם {view.roundSeconds} שניות.
                </p>
                <BigButton onClick={() => act("begin")} disabled={busy} color="bg-green-600">התחל סיבוב</BigButton>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold">{explainer?.name ?? "..."} מסביר/ה</h2>
                <p className="text-gray-500 text-sm">
                  {view.me?.team === view.activeTeam
                    ? "אתם הקבוצה המנחשת — היו מוכנים!"
                    : "הקבוצה שלכם צופה. אפשר לוודא שלא מרמים 😉"}
                </p>
                <button onClick={() => act("skipExplainer")} disabled={busy} className="text-xs text-gray-400 underline">
                  המסביר לא מגיב? החליפו תור
                </button>
              </>
            )}
          </Centered>
        )}

        {view.phase === "playing" && (
          <Centered>
            <TeamBadge view={view} team={view.activeTeam} />
            <div className="flex items-center gap-5">
              {/* key restarts the sand when a new turn starts; elapsed keeps it in step with the server clock */}
              <Hourglass key={view.turn} seconds={view.roundSeconds} size={72} glass="#dc2626" elapsed={view.roundSeconds - msLeft / 1000} />
              <div className={`text-6xl font-extrabold tabular-nums ${secondsLeft <= 10 ? "text-red-600" : "text-gray-800"}`}>
                {secondsLeft}
              </div>
            </div>
            {view.useDice && view.roll !== null && (
              <div className="flex items-center gap-3">
                <Dice value={view.roll} rollKey={rollKey} onSettled={setSettled} />
                <span className="text-sm text-gray-600">יצא <b className="text-2xl text-gray-900">{view.roll}</b></span>
              </div>
            )}
            {isExplainer && !revealed ? (
              <p className="text-lg font-bold py-6">🎲 מטילים קובייה...</p>
            ) : isExplainer && view.card && view.word ? (
              <>
                <AliasCard card={view.card} slot={view.slot} />
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
                {view.isReferee && view.card && view.word && (
                  <div className="w-full space-y-2">
                    <p className="text-xs font-bold text-orange-600">
                      מצב שופט: רק אתם רואים את המילה. ודאו שהמסביר לא מרמה ושהחבר שלו ענה נכון!
                    </p>
                    <AliasCard card={view.card} slot={view.slot} />
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
              <BigButton onClick={() => act("next")} disabled={busy} color="bg-red-600">אישור והמשך</BigButton>
            ) : (
              <p className="text-center text-gray-500 text-sm">ממתינים ל{explainer?.name ?? "המסביר"}...</p>
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
              <BigButton onClick={() => act("rematch")} disabled={busy} color="bg-red-600">משחק חדש</BigButton>
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

      {error && <p className="text-center text-sm bg-white/90 text-red-600 rounded-xl py-2">{error}</p>}

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
                    view.teamCount === n ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200"
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
            🎲 מצב קובייה (הטלה לכל מילה)
            <input
              type="checkbox"
              checked={view.useDice}
              onChange={(e) => act("settings", { useDice: e.target.checked })}
              className="w-5 h-5 accent-red-600"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            דילוג מחזיר צעד אחורה
            <input
              type="checkbox"
              checked={view.skipPenalty}
              onChange={(e) => act("settings", { skipPenalty: e.target.checked })}
              className="w-5 h-5 accent-red-600"
            />
          </label>
          <BigButton onClick={() => act("start")} disabled={busy || !canStart} color="bg-green-600">
            התחילו משחק
          </BigButton>
        </div>
      ) : (
        <p className="text-center text-gray-500 text-sm border-t pt-4">
          {view.teamCount} קבוצות · אורך הלוח: {view.targetScore} משבצות · {view.roundSeconds} שניות לתור{view.useDice ? " · מצב קובייה 🎲" : ""}
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
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          disabled={busy || (!pw && !hasPassword)}
          onClick={() => { onSave(pw); setPw(""); }}
          className="bg-red-600 disabled:opacity-40 text-white text-sm font-bold px-3 rounded-lg"
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
        </div>
      ))}
    </div>
  );
}

// One Alias card: 8 words, the number on the team's square picks the one to explain.
function AliasCard({ card, slot }: { card: string[]; slot: number }) {
  return (
    <div className="w-full rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden">
      <ul className="divide-y divide-red-100">
        {card.map((w, i) => {
          const active = i + 1 === slot;
          return (
            <li
              key={i}
              className={`flex items-center gap-3 px-3 ${
                active ? "bg-yellow-200 py-3 text-2xl font-extrabold text-red-900" : "py-1 text-sm text-gray-400"
              }`}
            >
              <span className={`w-6 shrink-0 text-center ${active ? "text-red-700" : "text-red-300"}`}>{i + 1}</span>
              <span className="flex-1 text-center break-words">{w}</span>
              <span className="w-6 shrink-0" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The board: numbered squares 1-8 repeating, start at the beginning, finish flag at the end.
function Board({ view }: { view: AliasView }) {
  const total = view.targetScore;
  return (
    <div className="bg-white/10 rounded-2xl p-3">
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: total + 1 }, (_, i) => {
          const here = teamsOf(view).filter((t) => view.scores[t] === i);
          const finish = i === total;
          return (
            <div
              key={i}
              className={`relative aspect-square rounded-md flex items-center justify-center text-[11px] font-bold ${
                finish ? "bg-yellow-300 text-yellow-900" : i === 0 ? "bg-white/30 text-white" : "bg-white text-red-800"
              }`}
            >
              {finish ? "🏁" : i === 0 ? "▶" : ((i - 1) % 8) + 1}
              {here.length > 0 && (
                <span className="absolute inset-0 flex items-center justify-center gap-0.5 rounded-md bg-black/20">
                  {here.map((t) => (
                    <span key={t} className={`w-3.5 h-3.5 rounded-full border-2 border-white ${TEAM_STYLE[t].bg}`} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-red-100 mt-2 text-center">
        {view.useDice
          ? "הלוח מראה כמה כל קבוצה התקדמה. המילה נקבעת בהטלת קובייה."
          : "העיגולים הם הקבוצות. המספר על המשבצת שבה קבוצה עומדת קובע איזו מילה מהקלף מסבירים."}
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
  return `בואו לשחק איתי Alias Games! 🗣️\nקוד חדר: ${code}\n${url}${hasPassword ? "\n(החדר מוגן בסיסמה, הסיסמה אצלי)" : ""}`;
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
