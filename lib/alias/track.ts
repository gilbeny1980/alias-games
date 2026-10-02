// Shared by the server (rules) and the client (drawing the board).
//
// The board is a winding river of stepping stones. Every stone has a CATEGORY (a colour and an icon);
// a team explains words from the category of the stone it stands on. Stones with a star start a
// mime round (explaining without speaking) on the team's next turn.

// The order in which the six categories repeat along the river
export const CATEGORY_PATTERN = [0, 3, 1, 5, 2, 4, 1, 0, 5, 3, 4, 2];
export const categoryAt = (step: number): number => CATEGORY_PATTERN[Math.max(0, step) % CATEGORY_PATTERN.length];

export const SPECIAL_WORDS = 4; // words acted out in a mime round
const STAR_FRACTIONS = [0.15, 0.32, 0.5, 0.68, 0.85];

export function specialSteps(total: number): number[] {
  const steps = STAR_FRACTIONS.map((f) => Math.min(total - 1, Math.max(1, Math.round(total * f))));
  return Array.from(new Set(steps));
}

export const isSpecialStep = (step: number, total: number) => specialSteps(total).includes(step);
