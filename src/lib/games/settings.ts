/** Per-party game settings, stored in parties.games. Safe to import anywhere. */

/** Baby trivia: a good mix to start with (ids from trivia-bank.ts) */
export const DEFAULT_TRIVIA = ["bones", "kneecaps", "stomach", "soft-spot", "due-date", "vernix", "colostrum", "top-girl-name", "first-tooth-age", "moro"];
export const MAX_TRIVIA = 20;

/** Baby animal names: a starting set (ids from animal-babies.ts) */
export const DEFAULT_ANIMALS = ["kangaroo", "swan", "owl", "goat", "deer", "goose", "horse", "frog", "hare", "turkey", "platypus", "llama"];
export const MAX_ANIMALS = 25;
export type PoolActualStored = { date: string; time: string | null; weightOz: number; lengthIn: number | null };

/** What earns a raffle entry. Each activity a guest has done is one entry. */
export type RaffleRules = { design: boolean; note: boolean; photos: boolean; games: boolean };
export type RaffleWinner = { prize: string; name: string; key: string; drawnAt: string; emailedAt: string | null };

export type RaffleSettings = {
  on: boolean;
  /** e.g. "$25 Target gift card"; one winner is drawn per prize */
  prizes: string[];
  rules: RaffleRules;
  /** Index matches `prizes`; null until that prize is drawn */
  winners: (RaffleWinner | null)[];
};

/** Optional prize for a game's winner(s). `emailed` records when each winner (by person key) was emailed. */
export type GamePrize = { on: boolean; prize: string; emailed: Record<string, string> };
export const NO_PRIZE: GamePrize = { on: false, prize: "", emailed: {} };

/** "Who has the daddy?": everyone scratches a card, one card hides the clear photo */
export type ScratchWho = "daddy" | "mommy";
export type ScratchSettings = {
  on: boolean;
  who: ScratchWho;
  /** About how many guests will play; the secret winning card is picked from 1 to this */
  expected: number;
  photoPath: string | null;
  prize: GamePrize;
};
export const scratchTitle = (who: ScratchWho) => (who === "mommy" ? "Who has the mommy?" : "Who has the daddy?");
export const MAX_SCRATCH_PLAYERS = 300;

/** Baby trivia: multiple choice, questions picked from the built-in bank */
export type TriviaSettings = { on: boolean; questions: string[]; closed: boolean; prize: GamePrize };

/** Baby animal names: typed answers; `accepted` = extra answers the host counts as right, per animal */
export type AnimalSettings = { on: boolean; questions: string[]; closed: boolean; accepted: Record<string, string[]>; prize: GamePrize };

export type GameSettings = {
  babyPhotos: { on: boolean; revealed: boolean; prize: GamePrize };
  trivia: TriviaSettings;
  animals: AnimalSettings;
  scratch: ScratchSettings;
  pool: { on: boolean; closed: boolean; actual: PoolActualStored | null; prize: GamePrize };
  raffle: RaffleSettings;
};

export const DEFAULT_GAMES: GameSettings = {
  babyPhotos: { on: true, revealed: false, prize: NO_PRIZE },
  pool: { on: true, closed: false, actual: null, prize: NO_PRIZE },
  scratch: { on: false, who: "daddy", expected: 20, photoPath: null, prize: NO_PRIZE },
  trivia: { on: false, questions: DEFAULT_TRIVIA, closed: false, prize: NO_PRIZE },
  animals: { on: false, questions: DEFAULT_ANIMALS, closed: false, accepted: {}, prize: NO_PRIZE },
  raffle: { on: false, prizes: [], rules: { design: true, note: false, photos: false, games: false }, winners: [] },
};

export const MAX_PRIZES = 5;

function parsePrize(raw: unknown): GamePrize {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<GamePrize>;
  const emailed: Record<string, string> = {};
  if (p.emailed && typeof p.emailed === "object") {
    for (const [k, v] of Object.entries(p.emailed)) if (typeof v === "string") emailed[k] = v;
  }
  return { on: Boolean(p.on), prize: typeof p.prize === "string" ? p.prize.slice(0, 80) : "", emailed };
}

export function parseGames(raw: unknown): GameSettings {
  const g = (raw && typeof raw === "object" ? raw : {}) as Partial<GameSettings>;
  const r = (g.raffle && typeof g.raffle === "object" ? g.raffle : {}) as Partial<RaffleSettings>;
  const prizes = Array.isArray(r.prizes) ? r.prizes.filter((p): p is string => typeof p === "string").slice(0, MAX_PRIZES) : [];
  const winners = prizes.map((_, i) => {
    const w = Array.isArray(r.winners) ? r.winners[i] : null;
    return w && typeof w === "object" && typeof w.name === "string" ? w : null;
  });
  return {
    babyPhotos: { ...DEFAULT_GAMES.babyPhotos, ...(g.babyPhotos ?? {}), prize: parsePrize(g.babyPhotos?.prize) },
    pool: { ...DEFAULT_GAMES.pool, ...(g.pool ?? {}), prize: parsePrize(g.pool?.prize) },
    scratch: parseScratch(g.scratch),
    trivia: parseTrivia(g.trivia),
    animals: parseAnimals(g.animals),
    raffle: {
      on: Boolean(r.on),
      prizes,
      rules: { ...DEFAULT_GAMES.raffle.rules, ...(r.rules ?? {}) },
      winners,
    },
  };
}

function parseScratch(raw: unknown): ScratchSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<ScratchSettings>;
  const expected = Math.round(Number(s.expected));
  return {
    on: Boolean(s.on),
    who: s.who === "mommy" ? "mommy" : "daddy",
    expected: Number.isFinite(expected) && expected >= 1 ? Math.min(expected, MAX_SCRATCH_PLAYERS) : DEFAULT_GAMES.scratch.expected,
    photoPath: typeof s.photoPath === "string" && s.photoPath ? s.photoPath : null,
    prize: parsePrize(s.prize),
  };
}

function parseTrivia(raw: unknown): TriviaSettings {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<TriviaSettings>;
  const questions = Array.isArray(t.questions)
    ? [...new Set(t.questions.filter((id): id is string => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id)))].slice(0, MAX_TRIVIA)
    : DEFAULT_TRIVIA;
  return { on: Boolean(t.on), questions, closed: Boolean(t.closed), prize: parsePrize(t.prize) };
}

function parseAnimals(raw: unknown): AnimalSettings {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<AnimalSettings>;
  const questions = Array.isArray(t.questions)
    ? [...new Set(t.questions.filter((id): id is string => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id)))].slice(0, MAX_ANIMALS)
    : DEFAULT_ANIMALS;
  const accepted: Record<string, string[]> = {};
  if (t.accepted && typeof t.accepted === "object") {
    for (const [id, list] of Object.entries(t.accepted)) {
      if (!/^[a-z0-9-]{1,40}$/.test(id) || !Array.isArray(list)) continue;
      const clean = list.filter((a): a is string => typeof a === "string" && a.length > 0 && a.length <= 40).slice(0, 20);
      if (clean.length) accepted[id] = clean;
    }
  }
  return { on: Boolean(t.on), questions, closed: Boolean(t.closed), accepted, prize: parsePrize(t.prize) };
}
