export type TeamId = 0 | 1 | 2 | 3;
export type AliasPhase = "lobby" | "ready" | "playing" | "roundEnd" | "special" | "finished";

export interface AliasPlayer {
  id: string;
  name: string;
  team: TeamId;
}

export interface WordResult {
  word: string;
  ok: boolean; // true = guessed, false = skipped
}

// A special round: a team landed on an outlined bubble. No timer; the explainer explains
// SPECIAL_WORDS words (the bubble's number picks the word on each card) to ALL teams, and every
// word goes to the team that guessed it first.
export interface SpecialState {
  team: TeamId; // the team that landed on the bubble (its explainer explains)
  slot: number; // the number on the bubble
  awards: (number | null)[]; // per finished word: the team that guessed it, or null
  word: string;
  card: string[];
}

// Full server-side room (never sent to clients as-is)
export interface AliasRoom {
  code: string;
  hostId: string;
  players: AliasPlayer[];
  phase: AliasPhase;
  targetScore: number;
  roundSeconds: number;
  skipPenalty: boolean;
  teamCount: number; // 2-4
  teamNames: string[]; // always 4 entries, the first teamCount are in play
  scores: number[]; // each team's square on the board (0 = start)
  turn: number; // global turn counter; team = turn % 2
  nextExplainer: number[]; // rotation index per team
  explainerId: string | null;
  endsAt: number | null;
  word: string | null;
  card: string[] | null; // current card: 8 words, the team's square number picks one
  special: SpecialState | null;
  deck: string[][];
  results: WordResult[];
  winner: TeamId | null;
  version: number;
  // optional room password: only a salted hash is stored, never sent to clients
  passHash?: string;
  passSalt?: string;
  badAttempts?: number;
  lockUntil?: number;
}

// What a given player is allowed to see
export interface AliasView {
  code: string;
  me: AliasPlayer | null;
  hostId: string;
  players: AliasPlayer[];
  phase: AliasPhase;
  targetScore: number;
  roundSeconds: number;
  skipPenalty: boolean;
  hasPassword: boolean;
  teamCount: number;
  teamNames: string[];
  isReferee: boolean; // on the other team: sees the word live to check for cheating
  special: { team: TeamId; slot: number; index: number; total: number; awards: (number | null)[] } | null;
  slot: number; // 1-8: the number on the bubble the active team stands on = which word of each card it explains
  card: string[] | null; // only for the explainer and the opposing team, only while playing
  scores: number[];
  turn: number;
  activeTeam: TeamId;
  explainerId: string | null;
  endsAt: number | null;
  word: string | null; // explainer and opposing team only, while playing
  results: WordResult[]; // hidden from the guessing team while playing
  roundScore: number;
  correctCount: number;
  skipCount: number;
  winner: TeamId | null;
  serverNow: number;
}
