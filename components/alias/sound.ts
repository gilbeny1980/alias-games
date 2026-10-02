// Sounds, synthesised in the browser (no audio files): the last-5-seconds countdown and the
// "time is up" buzzer. Browsers only allow sound after a tap, so unlockAudio() runs on the first touch.
let ctx: AudioContext | null = null;
let speechUnlocked = false;
const MUTE_KEY = "alias_muted";

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(m: boolean) {
  try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch {}
}

export function unlockAudio() {
  try {
    // iOS only allows speech after a touch: say nothing, once, to unlock it
    if (typeof window !== "undefined" && "speechSynthesis" in window && !speechUnlocked) {
      speechUnlocked = true;
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {}
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

// One soft bell/mallet note: a sine with two quieter overtones and a quick natural decay (no harsh edges)
function bell(c: AudioContext, freq: number, at: number, dur: number, volume: number) {
  const partials: [number, number][] = [[1, 1], [2, 0.28], [3.01, 0.1]];
  for (const [mult, amp] of partials) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * mult, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume * amp, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }
}

// Called once for each of the last seconds: 5, 4, 3, 2, 1. A rising scale of soft bells, so it is
// pleasant but you can hear the time running out: a single note at 5 and 4, a double ping at 3 and 2,
// and a quick three-note flourish at 1.
export function playTick(secondsLeft: number) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const notes: Record<number, number> = { 5: 659.25, 4: 783.99, 3: 880, 2: 1046.5, 1: 1318.5 }; // E5 G5 A5 C6 E6
  const f = notes[secondsLeft] ?? 783.99;
  if (secondsLeft === 1) {
    bell(c, 1318.5, t, 0.5, 0.3); // E6
    bell(c, 1568, t + 0.13, 0.5, 0.3); // G6
    bell(c, 2093, t + 0.26, 0.7, 0.3); // C7
  } else if (secondsLeft <= 3) {
    bell(c, f, t, 0.45, 0.34);
    bell(c, f, t + 0.22, 0.45, 0.3);
  } else {
    bell(c, f, t, 0.55, 0.36);
  }
}

// Time is up: a gentle but clear descending chime that settles on a warm low note
export function playTimeUp() {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + 0.01;
  bell(c, 783.99, t, 0.9, 0.4); // G5
  bell(c, 659.25, t + 0.3, 0.9, 0.4); // E5
  bell(c, 523.25, t + 0.6, 1.0, 0.42); // C5
  bell(c, 261.63, t + 0.6, 1.8, 0.4); // C4, the warm landing
  try { navigator.vibrate?.([200, 80, 200]); } catch {}
}

// Says a sentence out loud in Hebrew (the phone's own text-to-speech; silent if it has none or sound is muted)
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || isMuted()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // never queue up announcements
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "he-IL";
    const hebrew = synth.getVoices().find((v) => /^(he|iw)([-_]|$)/i.test(v.lang));
    if (hebrew) u.voice = hebrew;
    u.rate = 0.95;
    u.volume = 1;
    synth.speak(u);
  } catch {}
}
