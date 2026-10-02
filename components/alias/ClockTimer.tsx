"use client";
import { useState } from "react";

// A clock-face timer: a hand sweeps once round the dial while the coloured arc behind it shrinks
// (green, then amber, then red). `elapsed` (seconds already used) is read once on mount so the
// animation starts in step with the server clock and doesn't jitter on re-renders.
export default function ClockTimer({
  seconds,
  elapsed = 0,
  size = 96,
  urgent = false,
}: {
  seconds: number;
  elapsed?: number;
  size?: number;
  urgent?: boolean;
}) {
  const [delay] = useState(() => `-${Math.min(seconds, Math.max(0, elapsed))}s`);
  const anim = (name: string) => `${name} ${seconds}s linear ${delay} forwards`;
  const C = 2 * Math.PI * 40; // length of the arc's full circle
  const ticks = Array.from({ length: 12 }, (_, i) => i);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="שעון"
      className={urgent ? "animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]" : "drop-shadow-md"}
    >
      <circle cx="50" cy="50" r="48" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />

      {/* the hand and the remaining-time arc turn together; the arc always ends at 12 o'clock */}
      <g style={{ transformOrigin: "50px 50px", animation: anim("clock-spin") }}>
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          strokeDasharray={`${C} ${C}`}
          style={{ animation: `${anim("clock-arc")}, ${anim("clock-color")}` }}
        />
        <line x1="50" y1="50" x2="50" y2="15" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="58" stroke="#1f2937" strokeWidth="3.2" strokeLinecap="round" />
      </g>

      {ticks.map((i) => (
        <line
          key={i}
          x1="50"
          y1={i % 3 === 0 ? 5.5 : 7}
          x2="50"
          y2={i % 3 === 0 ? 12 : 10}
          stroke="#6b7280"
          strokeWidth={i % 3 === 0 ? 2.2 : 1.2}
          strokeLinecap="round"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="4.5" fill="#1f2937" />
      <circle cx="50" cy="50" r="1.6" fill="#fff" />
    </svg>
  );
}
