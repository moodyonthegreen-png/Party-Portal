import "server-only";
import { listBabyGuesses, listBabyPhotos, listGameAnswers, listPoolEntries, listTriviaAnswers } from "@/lib/games";
import { scoreTyped } from "@/lib/games/answer-match";
import { animalQuestions } from "@/lib/games/animal-babies";
import { scoreBabyPhotos, scorePool, scoreTrivia } from "@/lib/games/scoring";
import { triviaQuestions } from "@/lib/games/trivia-bank";
import { listScratchCards } from "@/lib/games/scratch";
import { scratchTitle } from "@/lib/games/settings";
import type { PublicParty } from "@/lib/parties";
import { personKey } from "@/lib/thanks-draft";

export type PrizeGame = "babyPhotos" | "pool" | "scratch" | "trivia" | "animals";
export const PRIZE_GAMES: PrizeGame[] = ["babyPhotos", "pool", "scratch", "trivia", "animals"];

/** Title case, for headings: "Who has the daddy?" */
export function gameTitle(game: PrizeGame, party: Pick<PublicParty, "games">): string {
  if (game === "scratch") return scratchTitle(party.games.scratch.who);
  if (game === "trivia") return "Baby trivia";
  if (game === "animals") return "Baby animal names";
  return game === "babyPhotos" ? "Guess the baby photo" : "Due date & weight pool";
}
/** Mid-sentence: "You won … in {name}" */
export function gameName(game: PrizeGame, party: Pick<PublicParty, "games">): string {
  if (game === "scratch") return `"${scratchTitle(party.games.scratch.who)}"`;
  if (game === "trivia") return "baby trivia";
  if (game === "animals") return "the baby animal names game";
  return game === "babyPhotos" ? "Guess the baby photo" : "the due date & weight pool";
}

export type GameWinner = { key: string; name: string; emailedAt: string | null };
export type GameResult = { game: PrizeGame; title: string; prize: string; winners: GameWinner[] };

/**
 * Winners of each game that has a prize switched on, once its results are
 * out. Everyone tied for first place wins.
 */
export async function gameWinners(party: PublicParty): Promise<GameResult[]> {
  const out: GameResult[] = [];
  const { babyPhotos, pool, scratch, trivia } = party.games;
  const wantTrivia = trivia.prize.on && trivia.prize.prize && trivia.closed;
  const animals = party.games.animals;
  const wantAnimals = animals.prize.on && animals.prize.prize && animals.closed;
  const wantBaby = babyPhotos.prize.on && babyPhotos.prize.prize && babyPhotos.revealed;
  const wantPool = pool.prize.on && pool.prize.prize && pool.actual;
  const wantScratch = scratch.prize.on && scratch.prize.prize;
  if (!party.sections.games || (!wantBaby && !wantPool && !wantScratch && !wantTrivia && !wantAnimals)) return out;

  if (wantBaby) {
    const [photos, guesses] = await Promise.all([listBabyPhotos(party.id), listBabyGuesses(party.id, null)]);
    const firsts = scoreBabyPhotos(photos, guesses).filter((r) => r.place === 1 && r.correct > 0);
    out.push({ game: "babyPhotos", title: gameTitle("babyPhotos", party), prize: babyPhotos.prize.prize, winners: uniq(firsts.map((r) => r.name), babyPhotos.prize.emailed) });
  }
  if (wantPool && pool.actual) {
    const entries = await listPoolEntries(party.id, null);
    const firsts = scorePool(pool.actual, entries).overall.filter((r) => r.place === 1);
    out.push({ game: "pool", title: gameTitle("pool", party), prize: pool.prize.prize, winners: uniq(firsts.map((r) => r.name), pool.prize.emailed) });
  }
  if (wantTrivia) {
    // Winners are final once the host closes the game; everyone tied for the top score wins
    const firsts = scoreTrivia(triviaQuestions(trivia.questions), (await listTriviaAnswers(party.id, null)) ?? []).filter((r) => r.place === 1 && r.correct > 0);
    out.push({ game: "trivia", title: gameTitle("trivia", party), prize: trivia.prize.prize, winners: uniq(firsts.map((r) => r.name), trivia.prize.emailed) });
  }
  if (wantAnimals) {
    const firsts = scoreTyped(animalQuestions(animals.questions), animals.accepted, (await listGameAnswers(party.id, "animals", null)) ?? []).filter((r) => r.place === 1 && r.correct > 0);
    out.push({ game: "animals", title: gameTitle("animals", party), prize: animals.prize.prize, winners: uniq(firsts.map((r) => r.name), animals.prize.emailed) });
  }
  if (wantScratch) {
    // Results are "out" as soon as someone scratches the winning card
    const found = (await listScratchCards(party.id))?.find((c) => c.winner);
    if (found) out.push({ game: "scratch", title: gameTitle("scratch", party), prize: scratch.prize.prize, winners: uniq([found.name], scratch.prize.emailed) });
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
