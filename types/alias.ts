export type TeamId = 0 | 1 | 2 | 3;
export type AliasPhase = "lobby" | "ready" | "playing" | "roundEnd" | "finished";

export interface AliasPlayer {
  id: string;
  name: string;
  team: TeamId;
}

export interface WordResult {
  word: string;
  ok: boolean; // true = guessed, false = skipped
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
  useDice: boolean; // a die roll (1-6) picks the word of each card instead of the board square
  roll: number | null;
  rollId: number; // increments on every roll so clients can animate it
  scores: number[]; // each team's square on the board (0 = start)
  turn: number; // global turn counter; team = turn % 2
  nextExplainer: number[]; // rotation index per team
  explainerId: string | null;
  endsAt: number | null;
  word: string | null;
  card: string[] | null; // current card: 8 words, the team's square number picks one
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
  useDice: boolean;
  roll: number | null;
  rollId: number;
  isReferee: boolean; // on the other team: sees the word live to check for cheating
  slot: number; // 1-8: which word of each card the active team explains
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
