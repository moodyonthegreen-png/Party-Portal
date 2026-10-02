/** Per-party game settings, stored in parties.games. Safe to import anywhere. */
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

export type GameSettings = {
  babyPhotos: { on: boolean; revealed: boolean; prize: GamePrize };
  scratch: ScratchSettings;
  pool: { on: boolean; closed: boolean; actual: PoolActualStored | null; prize: GamePrize };
  raffle: RaffleSettings;
};

export const DEFAULT_GAMES: GameSettings = {
  babyPhotos: { on: true, revealed: false, prize: NO_PRIZE },
  pool: { on: true, closed: false, actual: null, prize: NO_PRIZE },
  scratch: { on: false, who: "daddy", expected: 20, photoPath: null, prize: NO_PRIZE },
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
