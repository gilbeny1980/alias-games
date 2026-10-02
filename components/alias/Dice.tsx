"use client";
import { useEffect, useRef, useState } from "react";

// ── Sound: a synthesised dice rattle (no audio files needed) ──────────────
let ctx: AudioContext | null = null;
const MUTE_KEY = "alias_muted";

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {}
}

// browsers only allow audio after a tap, so call this from a user gesture
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

export function playDiceSound() {
  if (isMuted() || !ctx || ctx.state !== "running") return;
  const c = ctx;
  const t0 = c.currentTime + 0.02;
  // short noise clicks with growing gaps = a die bouncing and settling
  const hits = [0, 0.07, 0.15, 0.24, 0.34, 0.46, 0.6, 0.76];
  hits.forEach((dt, i) => {
    const len = Math.floor(c.sampleRate * 0.045);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let n = 0; n < len; n++) data[n] = (Math.random() * 2 - 1) * (1 - n / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200 + Math.random() * 1800;
    filter.Q.value = 1.2;
    const gain = c.createGain();
    gain.gain.value = 0.9 - i * 0.08;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0 + dt);
  });
  // a soft thud when it lands
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.setValueAtTime(160, t0 + 0.76);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.95);
  g.gain.setValueAtTime(0.5, t0 + 0.76);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.95);
  osc.connect(g).connect(c.destination);
  osc.start(t0 + 0.76);
  osc.stop(t0 + 1);
}

// ── Visual die ─────────────────────────────────────────────────────────────
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const ROLL_MS = 900;
let lastAnimated = "";

export function resetDice() {
  lastAnimated = "";
}

// Animates (and rattles) whenever `rollKey` changes; reports when it has landed.
export default function Dice({ value, rollKey, size = 72, onSettled }: { value: number; rollKey: string; size?: number; onSettled: (key: string) => void }) {
  const [face, setFace] = useState(value);
  const [rolling, setRolling] = useState(false);
  const settledCb = useRef(onSettled);
  settledCb.current = onSettled;

  useEffect(() => {
    if (lastAnimated === rollKey) {
      setFace(value);
      settledCb.current(rollKey);
      return;
    }
    lastAnimated = rollKey;
    setRolling(true);
    playDiceSound();
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    const done = setTimeout(() => {
      clearInterval(spin);
      setFace(value);
      setRolling(false);
      settledCb.current(rollKey);
    }, ROLL_MS);
    return () => { clearInterval(spin); clearTimeout(done); };
  }, [rollKey, value]);

  return (
    <div
      className={`bg-white rounded-2xl border-2 border-gray-300 shadow-lg grid grid-cols-3 grid-rows-3 p-2 ${rolling ? "animate-bounce" : ""}`}
      style={{ width: size, height: size, transform: rolling ? `rotate(${(face * 47) % 40 - 20}deg)` : undefined }}
      aria-label={`קובייה: ${face}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[face].includes(i) && <span className="w-[70%] h-[70%] rounded-full bg-gray-900" />}
        </span>
      ))}
    </div>
  );
}
