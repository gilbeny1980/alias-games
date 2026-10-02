"use client";
import { useEffect, useId, useState } from "react";

export const SPLASH_SECONDS = 5;

// A glass hourglass in a wooden frame. `elapsed` (seconds already used up) is
// read once on mount, so the animation can start in sync with a server deadline
// without jittering on re-renders. `glass` is the colour of the glass outline.
export function Hourglass({ seconds = SPLASH_SECONDS, size = 120, elapsed = 0, glass = "#e0f2fe" }: { seconds?: number; size?: number; elapsed?: number; glass?: string }) {
  const [delay] = useState(() => `-${Math.min(seconds, Math.max(0, elapsed))}s`);
  const dur = `${seconds}s linear ${delay} forwards`;
  const id = useId().replace(/:/g, "");
  const topBulb = "M27 17H73C73 45 54 58 54 75H46C46 58 27 45 27 17Z";
  const bottomBulb = "M46 75H54C54 92 73 105 73 133H27C27 105 46 92 46 75Z";
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 100 150" aria-hidden>
      <defs>
        <clipPath id={`${id}t`}><path d={topBulb} /></clipPath>
        <clipPath id={`${id}b`}><path d={bottomBulb} /></clipPath>
        <linearGradient id={`${id}plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c58b52" />
          <stop offset="1" stopColor="#8a5428" />
        </linearGradient>
        <linearGradient id={`${id}post`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b3d19" />
          <stop offset="0.45" stopColor="#c58b52" />
          <stop offset="1" stopColor="#6b3d19" />
        </linearGradient>
      </defs>

      {/* glass */}
      <path d={`${topBulb}${bottomBulb}`} fill="rgba(147,197,253,0.28)" />
      <g clipPath={`url(#${id}t)`}>
        <rect x="20" y="30" width="60" height="46" fill="#fbbf24"
          style={{ animation: `sand-top ${dur}` }} />
      </g>
      <g clipPath={`url(#${id}b)`}>
        <rect x="20" y="105" width="60" height="30" fill="#fbbf24"
          style={{ animation: `sand-bottom ${dur}` }} />
        <line x1="50" y1="75" x2="50" y2="133" stroke="#f59e0b" strokeWidth="1.6"
          style={{ animation: `sand-stream ${dur}` }} />
      </g>
      <path d={`${topBulb}${bottomBulb}`} fill="none" stroke={glass} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M33 24C34 38 41 47 47 55" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />

      {/* wooden posts, with turned rings */}
      {[11, 83].map((x) => (
        <g key={x}>
          <rect x={x} y="16" width="6" height="118" rx="2" fill={`url(#${id}post)`} />
          <rect x={x - 1.5} y="38" width="9" height="4" rx="1.5" fill="#7a4a22" />
          <rect x={x - 1.5} y="108" width="9" height="4" rx="1.5" fill="#7a4a22" />
        </g>
      ))}

      {/* wooden top and bottom plates */}
      {[4, 134].map((y) => (
        <g key={y}>
          <rect x="4" y={y} width="92" height="12" rx="3" fill={`url(#${id}plate)`} />
          <rect x="4" y={y + 9} width="92" height="3" rx="1.5" fill="#6b3d19" opacity="0.55" />
          <path d={`M12 ${y + 4}H50M58 ${y + 4}H88M20 ${y + 7}H70`} stroke="#5c3517" strokeOpacity="0.35" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

export default function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, SPLASH_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      onClick={onDone}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white animate-fade-in"
    >
      <div className="text-5xl bg-white rounded-3xl w-20 h-20 flex items-center justify-center shadow-xl">🗣️</div>
      <h1 className="text-5xl font-extrabold" dir="ltr">Alias Games</h1>
      <Hourglass />
      <p className="text-blue-100 text-lg">
        פותח ע״י <span className="font-bold text-white">גיל בן יהודה</span>
      </p>
      <p className="text-blue-200/70 text-xs absolute bottom-8">לחצו כדי לדלג</p>
    </div>
  );
}
