import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { ALIAS_WORDS } from "./words";
import { SPECIAL_WORDS, isSpecialStep } from "./track";
import type { AliasPlayer, AliasRoom, AliasView, TeamId } from "@/types/alias";

export class GameError extends Error {}

export const MIN_PER_TEAM = 2;
export const CARD_SIZE = 8;
export const MAX_TEAMS = 4;
export const MAX_PLAYERS = 20;
export const DEFAULT_TEAM_NAMES = ["האדומים", "הכחולים", "הירוקים", "הצהובים"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Alias cards: 8 words each. The square a team stands on picks the word.
function buildDeck(): string[][] {
  const words = shuffle(ALIAS_WORDS);
  const cards: string[][] = [];
  for (let i = 0; i + CARD_SIZE <= words.length; i += CARD_SIZE) cards.push(words.slice(i, i + CARD_SIZE));
  return cards;
}

export function newCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const MAX_PASSWORD = 30;
export const MAX_BAD_ATTEMPTS = 5;
export const LOCK_MS = 60_000;

// An empty password removes protection.
export function setRoomPassword(room: AliasRoom, password: unknown) {
  const pw = String(password ?? "").slice(0, MAX_PASSWORD);
  if (!pw) {
    delete room.passHash;
    delete room.passSalt;
    return;
  }
  room.passSalt = randomBytes(16).toString("hex");
  room.passHash = scryptSync(pw, room.passSalt, 32).toString("hex");
}

export function checkRoomPassword(room: AliasRoom, password: unknown): boolean {
  if (!room.passHash || !room.passSalt) return true;
  const given = scryptSync(String(password ?? "").slice(0, MAX_PASSWORD), room.passSalt, 32);
  return timingSafeEqual(given, Buffer.from(room.passHash, "hex"));
}

export function createRoom(code: string, hostName: string, password?: unknown): { room: AliasRoom; player: AliasPlayer } {
  const player: AliasPlayer = { id: randomUUID(), name: cleanName(hostName), team: 0 };
  const room: AliasRoom = {
    code,
    hostId: player.id,
    players: [player],
    phase: "lobby",
    targetScore: 70, // the real board: 70 steps from the first bubble to the centre
    roundSeconds: 60,
    skipPenalty: true,
    teamCount: 2,
    teamNames: [...DEFAULT_TEAM_NAMES],
    scores: [0, 0, 0, 0],
    turn: 0,
    nextExplainer: [0, 0, 0, 0],
    explainerId: null,
    endsAt: null,
    word: null,
    card: null,
    special: null,
    deck: buildDeck(),
    results: [],
    winner: null,
    version: 0,
  };
  setRoomPassword(room, password);
  return { room, player };
}

function cleanName(name: unknown): string {
  const n = String(name ?? "").trim().slice(0, 20);
  if (!n) throw new GameError("חסר שם");
  return n;
}

export const teamOf = (room: AliasRoom): TeamId => (room.turn % room.teamCount) as TeamId;
const teamIds = (room: AliasRoom) => Array.from({ length: room.teamCount }, (_, i) => i as TeamId);
const members = (room: AliasRoom, team: TeamId) => room.players.filter((p) => p.team === team);

export function roundScore(room: AliasRoom): number {
  return room.results.reduce((sum, r) => sum + (r.ok ? 1 : room.skipPenalty ? -1 : 0), 0);
}

// Number (1-8) printed on the bubble a team stands on. Everybody starts on bubble 1,
// and the numbers repeat 1-8 along the whole track, as on the real board.
export const slotFor = (position: number) => (Math.max(0, position) % CARD_SIZE) + 1;

function drawWord(room: AliasRoom): string {
  if (room.deck.length === 0) room.deck = buildDeck();
  room.card = room.deck.pop()!;
  return room.card[slotFor(room.scores[teamOf(room)]) - 1];
}

// Lazily ends a round whose time ran out. Safe to run on any copy.
export function tick(room: AliasRoom, now = Date.now()): boolean {
  if (room.phase === "playing" && room.endsAt !== null && now >= room.endsAt) {
    room.phase = "roundEnd";
    room.word = null;
    room.card = null;
    return true;
  }
  return false;
}

function prepareTurn(room: AliasRoom) {
  const team = teamOf(room);
  const list = members(room, team);
  if (list.length === 0) {
    room.phase = "lobby";
    room.explainerId = null;
    return;
  }
  room.explainerId = list[room.nextExplainer[team] % list.length].id;
  room.nextExplainer[team] += 1;
  room.phase = "ready";
  room.endsAt = null;
  room.word = null;
  room.card = null;
  room.special = null;
  room.results = [];
}

function drawSpecialWord(sp: NonNullable<AliasRoom["special"]>, room: AliasRoom) {
  if (room.deck.length === 0) room.deck = buildDeck();
  sp.card = room.deck.pop()!;
  sp.word = sp.card[sp.slot - 1];
}

function startSpecial(room: AliasRoom, team: TeamId, slot: number) {
  room.phase = "special";
  room.endsAt = null;
  room.word = null;
  room.card = null;
  room.special = { team, slot, awards: [], word: "", card: [] };
  drawSpecialWord(room.special, room);
}

// Ends the current turn: the game can only end after every team has had the same number of turns.
function finishTurn(room: AliasRoom) {
  const roundDone = room.turn % room.teamCount === room.teamCount - 1;
  const live = room.scores.slice(0, room.teamCount);
  const best = Math.max(...live);
  if (roundDone && best >= room.targetScore && live.filter((v) => v === best).length === 1) {
    room.phase = "finished";
    room.winner = live.indexOf(best) as TeamId;
    room.explainerId = null;
    return;
  }
  room.turn += 1;
  prepareTurn(room);
}

function resetToLobby(room: AliasRoom) {
  room.phase = "lobby";
  room.scores = [0, 0, 0, 0];
  room.turn = 0;
  room.nextExplainer = [0, 0, 0, 0];
  room.explainerId = null;
  room.endsAt = null;
  room.word = null;
  room.card = null;
  room.special = null;
  room.results = [];
  room.winner = null;
}

export function addPlayer(room: AliasRoom, name: string): AliasPlayer {
  const n = cleanName(name);
  if (room.players.length >= MAX_PLAYERS) throw new GameError("החדר מלא");
  if (room.players.some((p) => p.name === n)) throw new GameError("השם כבר תפוס בחדר");
  // join the smallest team in play
  const team = teamIds(room).reduce((best, t) => (members(room, t).length < members(room, best).length ? t : best), 0 as TeamId);
  const player = { id: randomUUID(), name: n, team };
  room.players.push(player);
  return player;
}

function cleanTeamName(name: unknown): string {
  const n = String(name ?? "").trim().slice(0, 16);
  if (!n) throw new GameError("שם קבוצה לא יכול להיות ריק");
  return n;
}

export type Action = { action: string; [k: string]: unknown };

export function applyAction(room: AliasRoom, playerId: string, a: Action): void {
  tick(room);
  const me = room.players.find((p) => p.id === playerId);
  if (!me) throw new GameError("אינך חלק מהחדר");
  const isHost = room.hostId === me.id;
  const isExplainer = room.explainerId === me.id;

  switch (a.action) {
    case "setTeam": {
      if (room.phase !== "lobby") throw new GameError("אפשר להחליף קבוצה רק בלובי");
      const t = Number(a.team);
      if (!Number.isInteger(t) || t < 0 || t >= room.teamCount) throw new GameError("קבוצה לא קיימת");
      me.team = t as TeamId;
      break;
    }
    case "renameTeam": {
      if (room.phase !== "lobby") throw new GameError("אפשר לשנות שם קבוצה רק בלובי");
      const t = Number(a.team);
      if (!Number.isInteger(t) || t < 0 || t >= MAX_TEAMS) throw new GameError("קבוצה לא קיימת");
      if (!isHost && me.team !== t) throw new GameError("אפשר לשנות רק את שם הקבוצה שלך");
      const name = cleanTeamName(a.name);
      if (room.teamNames.some((n, i) => i !== t && i < room.teamCount && n === name))
        throw new GameError("כבר יש קבוצה בשם הזה");
      room.teamNames[t] = name;
      break;
    }
    case "setPassword": {
      if (!isHost || room.phase !== "lobby") throw new GameError("רק המארח יכול לשנות סיסמה בלובי");
      setRoomPassword(room, a.password);
      break;
    }
    case "settings": {
      if (!isHost || room.phase !== "lobby") throw new GameError("רק המארח יכול לשנות הגדרות");
      const target = Number(a.targetScore);
      const secs = Number(a.roundSeconds);
      if (Number.isFinite(target)) room.targetScore = Math.min(100, Math.max(20, Math.round(target)));
      if (Number.isFinite(secs)) room.roundSeconds = Math.min(180, Math.max(20, Math.round(secs)));
      if (typeof a.skipPenalty === "boolean") room.skipPenalty = a.skipPenalty;
      const count = Number(a.teamCount);
      if (Number.isInteger(count) && count >= 2 && count <= MAX_TEAMS && count !== room.teamCount) {
        room.teamCount = count;
        // spread everyone evenly over the teams in play
        room.players.forEach((p, i) => { p.team = (i % count) as TeamId; });
      }
      break;
    }
    case "start": {
      if (!isHost || room.phase !== "lobby") throw new GameError("רק המארח יכול להתחיל");
      if (teamIds(room).some((t) => members(room, t).length < MIN_PER_TEAM))
        throw new GameError(`צריך לפחות ${MIN_PER_TEAM} שחקנים בכל קבוצה`);
      room.scores = [0, 0, 0, 0];
      room.turn = 0;
      room.nextExplainer = [0, 0, 0, 0];
      room.winner = null;
      prepareTurn(room);
      break;
    }
    case "begin": {
      if (room.phase !== "ready" || !isExplainer) throw new GameError("לא התור שלך");
      room.phase = "playing";
      room.endsAt = Date.now() + room.roundSeconds * 1000;
      room.results = [];
      room.word = drawWord(room);
      break;
    }
    case "correct":
    case "skip": {
      if (room.phase !== "playing" || !isExplainer || !room.word) throw new GameError("הסיבוב לא פעיל");
      room.results.push({ word: room.word, ok: a.action === "correct" });
      room.word = drawWord(room);
      break;
    }
    case "toggle": {
      if (room.phase !== "roundEnd" || !isExplainer) throw new GameError("רק המסביר יכול לתקן");
      const r = room.results[Number(a.index)];
      if (!r) throw new GameError("מילה לא קיימת");
      r.ok = !r.ok;
      break;
    }
    case "next": {
      if (room.phase !== "roundEnd" || !(isExplainer || isHost)) throw new GameError("לא ניתן להמשיך");
      const team = teamOf(room);
      const before = room.scores[team];
      const after = Math.min(room.targetScore, Math.max(0, before + roundScore(room)));
      room.scores[team] = after;
      // landing (moving forward) on an outlined bubble starts a special round
      if (after > before && after < room.targetScore && isSpecialStep(after, room.targetScore)) {
        startSpecial(room, team, slotFor(after));
        break;
      }
      finishTurn(room);
      break;
    }
    case "award": {
      // special round: the explainer says which team guessed the word first (or nobody)
      if (room.phase !== "special" || !room.special || !(isExplainer || isHost)) throw new GameError("אין סיבוב מיוחד פעיל");
      const sp = room.special;
      const t = a.team === null ? null : Number(a.team);
      if (t !== null && (!Number.isInteger(t) || t < 0 || t >= room.teamCount)) throw new GameError("קבוצה לא קיימת");
      sp.awards.push(t);
      if (t !== null) room.scores[t] = Math.min(room.targetScore, room.scores[t] + 1);
      if (sp.awards.length >= SPECIAL_WORDS) {
        room.special = null;
        finishTurn(room);
      } else {
        drawSpecialWord(sp, room);
      }
      break;
    }
    case "skipExplainer": {
      // unblocks the game if the explainer disconnected
      if (room.phase !== "ready") throw new GameError("אפשר להחליף מסביר רק לפני תחילת הסיבוב");
      room.turn += 1;
      prepareTurn(room);
      break;
    }
    case "rematch": {
      if (!isHost || room.phase !== "finished") throw new GameError("רק המארח יכול להתחיל משחק חדש");
      resetToLobby(room);
      break;
    }
    case "leave": {
      removePlayer(room, me.id);
      break;
    }
    default:
      throw new GameError("פעולה לא מוכרת");
  }
  room.version += 1;
}

// returns true if the room is now empty
export function removePlayer(room: AliasRoom, playerId: string): boolean {
  const wasExplainer = room.explainerId === playerId;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.length === 0) return true;
  if (room.hostId === playerId) room.hostId = room.players[0].id;
  const active = ["ready", "playing", "roundEnd", "special"].includes(room.phase);
  if (active && teamIds(room).some((t) => members(room, t).length < 1)) {
    resetToLobby(room);
  } else if (wasExplainer && (room.phase === "ready" || room.phase === "playing" || room.phase === "special")) {
    prepareTurn(room); // same team, new explainer
  }
  return false;
}

export function viewFor(room: AliasRoom, playerId: string | null): AliasView {
  const copy: AliasRoom = structuredClone(room);
  tick(copy);
  const me = copy.players.find((p) => p.id === playerId) ?? null;
  const isExplainer = !!me && copy.explainerId === me.id;
  const isReferee = !!me && me.team !== teamOf(copy);
  // the explainer and the opposing team (as referees) may see the word; the guessers may not
  const canSee = isExplainer || isReferee;
  const revealResults = copy.phase !== "playing" || canSee;
  return {
    code: copy.code,
    me,
    hostId: copy.hostId,
    players: copy.players,
    phase: copy.phase,
    targetScore: copy.targetScore,
    roundSeconds: copy.roundSeconds,
    skipPenalty: copy.skipPenalty,
    hasPassword: !!copy.passHash,
    teamCount: copy.teamCount,
    teamNames: copy.teamNames,
    scores: copy.scores,
    turn: copy.turn,
    activeTeam: teamOf(copy),
    explainerId: copy.explainerId,
    endsAt: copy.endsAt,
    word: copy.phase === "special" ? (isExplainer ? copy.special?.word ?? null : null) : copy.phase === "playing" && canSee ? copy.word : null,
    isReferee,
    slot: slotFor(copy.scores[teamOf(copy)]),
    card: copy.phase === "special" ? (isExplainer ? copy.special?.card ?? null : null) : copy.phase === "playing" && canSee ? copy.card : null,
    special: copy.special
      ? { team: copy.special.team, slot: copy.special.slot, index: copy.special.awards.length, total: SPECIAL_WORDS, awards: copy.special.awards }
      : null,
    results: revealResults ? copy.results : [],
    roundScore: roundScore(copy),
    correctCount: copy.results.filter((r) => r.ok).length,
    skipCount: copy.results.filter((r) => !r.ok).length,
    winner: copy.winner,
    serverNow: Date.now(),
  };
}
