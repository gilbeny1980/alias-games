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

// A mime round: a team landed on a star stone. No timer and no speaking: the explainer acts out
// SPECIAL_WORDS words (from the stone's category) and ALL teams guess; every word goes to the team
// that guessed it first.
export interface SpecialState {
  team: TeamId; // the team that landed on the bubble (its explainer explains)
  category: number; // the category of the stone the team landed on
  awards: (number | null)[]; // per finished word: the team that guessed it, or null
  word: string;
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
  special: SpecialState | null;
  // per team: the category of the star stone it landed on, if its mime round is still owed (played on its NEXT turn)
  specialPending: (number | null)[];
  decks: string[][]; // shuffled words per category
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
  special: { team: TeamId; category: number; index: number; total: number; awards: (number | null)[] } | null;
  specialPending: (number | null)[]; // a ⭐ for teams that owe a special round on their next turn
  specialTurn: number | null; // in "ready": the category if the coming turn is a mime round
  category: number; // the category of the stone the active team stands on (its words come from here)
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
