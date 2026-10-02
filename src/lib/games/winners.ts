import "server-only";
import { listBabyGuesses, listBabyPhotos, listPoolEntries } from "@/lib/games";
import { scoreBabyPhotos, scorePool } from "@/lib/games/scoring";
import type { PublicParty } from "@/lib/parties";
import { personKey } from "@/lib/thanks-draft";

export type PrizeGame = "babyPhotos" | "pool";
export const GAME_NAMES: Record<PrizeGame, string> = { babyPhotos: "Guess the baby photo", pool: "the due date & weight pool" };
export const GAME_TITLES: Record<PrizeGame, string> = { babyPhotos: "Guess the baby photo", pool: "Due date & weight pool" };

export type GameWinner = { key: string; name: string; emailedAt: string | null };
export type GameResult = { game: PrizeGame; prize: string; winners: GameWinner[] };

/**
 * Winners of each game that has a prize switched on, once its results are
 * out. Everyone tied for first place wins.
 */
export async function gameWinners(party: PublicParty): Promise<GameResult[]> {
  const out: GameResult[] = [];
  const { babyPhotos, pool } = party.games;
  const wantBaby = babyPhotos.prize.on && babyPhotos.prize.prize && babyPhotos.revealed;
  const wantPool = pool.prize.on && pool.prize.prize && pool.actual;
  if (!party.sections.games || (!wantBaby && !wantPool)) return out;

  if (wantBaby) {
    const [photos, guesses] = await Promise.all([listBabyPhotos(party.id), listBabyGuesses(party.id, null)]);
    const firsts = scoreBabyPhotos(photos, guesses).filter((r) => r.place === 1 && r.correct > 0);
    out.push({ game: "babyPhotos", prize: babyPhotos.prize.prize, winners: uniq(firsts.map((r) => r.name), babyPhotos.prize.emailed) });
  }
  if (wantPool && pool.actual) {
    const entries = await listPoolEntries(party.id, null);
    const firsts = scorePool(pool.actual, entries).overall.filter((r) => r.place === 1);
    out.push({ game: "pool", prize: pool.prize.prize, winners: uniq(firsts.map((r) => r.name), pool.prize.emailed) });
  }
  return out;
}

function uniq(names: string[], emailed: Record<string, string>): GameWinner[] {
  const seen = new Map<string, GameWinner>();
  for (const name of names) {
    const key = personKey(name);
    if (!seen.has(key)) seen.set(key, { key, name: name.trim(), emailedAt: emailed[key] ?? null });
  }
  return [...seen.values()];
}
