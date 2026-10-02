"use client";
import { useId } from "react";

// The emblem of "יובל" (a stream): a dark rounded badge with three flowing ribbons of colour and a spark.
export function YuvalEmblem({ size = 120 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const wave = (y: number, shift: number) =>
    `M${34 + shift} ${y} C ${58 + shift} ${y - 28}, ${84 + shift} ${y + 28}, ${108 + shift} ${y} S ${150 + shift} ${y - 26}, ${166} ${y - 4}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="יובל" className="drop-shadow-[0_10px_20px_rgba(15,10,60,0.5)]">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0e7ff" />
        </linearGradient>
        <linearGradient id={`${id}1`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id={`${id}2`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id={`${id}3`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="184" height="184" rx="56" fill={`url(#${id}b)`} />
      <rect x="8" y="8" width="184" height="184" rx="56" fill="none" stroke="#c7d2fe" strokeOpacity="0.9" strokeWidth="2" />
      <path d={wave(74, 0)} fill="none" stroke={`url(#${id}1)`} strokeWidth="15" strokeLinecap="round" />
      <path d={wave(106, -6)} fill="none" stroke={`url(#${id}2)`} strokeWidth="15" strokeLinecap="round" />
      <path d={wave(138, 4)} fill="none" stroke={`url(#${id}3)`} strokeWidth="15" strokeLinecap="round" />
      {/* the spark: an idea / a guessed word */}
      <path d="M150 30 L156 45 L171 51 L156 57 L150 72 L144 57 L129 51 L144 45 Z" fill="#7c3aed" />
    </svg>
  );
}

// Full logo: emblem + wordmark + tagline
export default function YuvalLogo({ size = 240, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center select-none" style={{ width: size, margin: "0 auto" }}>
      <YuvalEmblem size={size * 0.52} />
      <div
        className="font-black text-white leading-none"
        style={{ fontSize: size * 0.3, marginTop: size * 0.03, letterSpacing: "-0.01em", textShadow: "0 4px 14px rgba(30,27,75,0.45)" }}
      >
        יובל
      </div>
      {tagline && (
        <div className="font-bold text-white/90" style={{ fontSize: size * 0.07, marginTop: size * 0.03 }}>
          משחק מילים לכל המשפחה
        </div>
      )}
    </div>
  );
}

// Small version for headers
export function YuvalBadge() {
  return (
    <span className="inline-flex items-center gap-2">
      <YuvalEmblem size={34} />
      <span className="font-black text-xl tracking-tight">יובל</span>
    </span>
  );
}
