// Sounds, synthesised in the browser (no audio files): the last-5-seconds countdown and the
// "time is up" buzzer. Browsers only allow sound after a tap, so unlockAudio() runs on the first touch.
let ctx: AudioContext | null = null;
const MUTE_KEY = "alias_muted";

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {}
}

export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {}
}

function ready(): AudioContext | null {
  if (isMuted() || !ctx || ctx.state !== "running") return null;
  return ctx;
}

// one tone with a quick fade in/out so it doesn't click
function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, volume: number, endFreq?: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + dur);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.setValueAtTime(volume, at + Math.max(0.02, dur - 0.04));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

// Called once for each of the last seconds: 5, 4, 3, 2, 1. It gets more urgent as the time runs out:
// higher pitch every second, a double beep at 3 and 2, and a fast triple beep at 1.
export function playTick(secondsLeft: number) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const freq = { 5: 700, 4: 800, 3: 920, 2: 1060, 1: 1250 }[secondsLeft] ?? 800;
  const beeps = secondsLeft === 1 ? [0, 0.14, 0.28] : secondsLeft <= 3 ? [0, 0.2] : [0];
  const len = secondsLeft === 1 ? 0.1 : 0.14;
  beeps.forEach((dt) => tone(c, freq, t + dt, len, "square", 0.32));
}

// Time is up: a long, harsh buzzer
export function playTimeUp() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  tone(c, 190, t, 1.1, "sawtooth", 0.45, 110);
  tone(c, 196, t, 1.1, "square", 0.25, 112);
  tone(c, 1500, t, 0.18, "square", 0.2);
  try { navigator.vibrate?.([300, 100, 300]); } catch {}
}
