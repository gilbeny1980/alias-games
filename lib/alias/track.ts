// Shared by the server (rules) and the client (drawing the board).
//
// The real board has 70 steps from the first bubble to the centre, and five bubbles drawn
// as outlines: landing on one starts a special round. Their positions (counted on the real board)
// are below; for other board lengths they are spread in the same proportions.
const REAL_TOTAL = 70;
const REAL_SPECIALS = [9, 21, 36, 52, 64];

export const SPECIAL_WORDS = 5; // words explained in a special round

export function specialSteps(total: number): number[] {
  if (total === REAL_TOTAL) return REAL_SPECIALS;
  const steps = REAL_SPECIALS.map((s) => Math.min(total - 1, Math.max(1, Math.round((s * total) / REAL_TOTAL))));
  return Array.from(new Set(steps));
}

export const isSpecialStep = (step: number, total: number) => specialSteps(total).includes(step);
