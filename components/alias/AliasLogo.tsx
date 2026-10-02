// The game's logo: a big white speech bubble with bold red lettering,
// in the spirit of the classic red box.
export default function AliasLogo({ size = 260, tagline = true }: { size?: number; tagline?: boolean }) {
  return (
    <div className="relative mx-auto select-none" style={{ width: size, height: size * 1.02 }} role="img" aria-label="Alias Games">
      <svg viewBox="0 0 300 306" className="absolute inset-0 w-full h-full drop-shadow-[0_10px_18px_rgba(90,0,0,0.35)]" aria-hidden>
        {/* bubble body + tail pointing down to the right, like the box */}
        <circle cx="150" cy="146" r="140" fill="#fff" />
        <path d="M196 262 C214 276 232 290 262 302 C246 280 240 262 240 240 Z" fill="#fff" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6" style={{ paddingBottom: size * 0.04 }}>
        <div
          className="font-black leading-none text-red-600"
          style={{ fontSize: size * 0.265, letterSpacing: "-0.02em", textShadow: "0 2px 0 rgba(0,0,0,0.08)" }}
        >
          אליאס
        </div>
        <div className="font-bold text-red-600/80 tracking-[0.2em] uppercase" dir="ltr" style={{ fontSize: size * 0.05, marginTop: size * 0.03 }}>
          Alias Games
        </div>
        {tagline && (
          <div className="font-extrabold text-red-600 leading-tight" style={{ fontSize: size * 0.085, marginTop: size * 0.05 }}>
            משחק מילים
            <br />
            לכל המשפחה!
          </div>
        )}
      </div>
    </div>
  );
}

// Small version for headers
export function AliasBadge() {
  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <svg viewBox="0 0 40 42" className="w-8 h-8 drop-shadow" aria-hidden>
        <circle cx="19" cy="19" r="18" fill="#fff" />
        <path d="M26 33 C29 36 33 39 38 41 C35 37 34 34 34 30 Z" fill="#fff" />
        <circle cx="12" cy="19" r="2.6" fill="#dc2626" />
        <circle cx="19" cy="19" r="2.6" fill="#dc2626" />
        <circle cx="26" cy="19" r="2.6" fill="#dc2626" />
      </svg>
      <span className="font-black text-lg tracking-tight">Alias Games</span>
    </span>
  );
}
