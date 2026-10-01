/** Per-party game settings, stored in parties.games. Safe to import anywhere. */
export type PoolActualStored = { date: string; time: string | null; weightOz: number; lengthIn: number | null };

export type GameSettings = {
  babyPhotos: { on: boolean; revealed: boolean };
  pool: { on: boolean; closed: boolean; actual: PoolActualStored | null };
};

export const DEFAULT_GAMES: GameSettings = {
  babyPhotos: { on: true, revealed: false },
  pool: { on: true, closed: false, actual: null },
};

export function parseGames(raw: unknown): GameSettings {
  const g = (raw && typeof raw === "object" ? raw : {}) as Partial<GameSettings>;
  return {
    babyPhotos: { ...DEFAULT_GAMES.babyPhotos, ...(g.babyPhotos ?? {}) },
    pool: { ...DEFAULT_GAMES.pool, ...(g.pool ?? {}) },
  };
}
