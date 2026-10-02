/**
 * Game scoring. Pure functions (no database), so they can be unit-tested.
 */

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Give tied scores the same place: 1, 2, 2, 4 ... */
function placeBy<T>(rows: T[], key: (r: T) => number, better: "high" | "low"): (T & { place: number })[] {
  const sorted = [...rows].sort((a, b) => (better === "high" ? key(b) - key(a) : key(a) - key(b)));
  let place = 0;
  let prev: number | null = null;
  return sorted.map((r, i) => {
    const k = key(r);
    if (prev === null || k !== prev) place = i + 1;
    prev = k;
    return { ...r, place };
  });
}

// ---------------------------------------------------------------------------
// Guess the Baby Photo
// ---------------------------------------------------------------------------

export type BabyEntry = { name: string; guesses: Record<string, string> };

export function scoreBabyPhotos(photos: { id: string; answer: string }[], entries: BabyEntry[]) {
  const rows = entries.map((e) => ({
    name: e.name,
    correct: photos.filter((p) => e.guesses[p.id] && norm(e.guesses[p.id]) === norm(p.answer)).length,
    total: photos.length,
  }));
  return placeBy(rows, (r) => r.correct, "high");
}

// ---------------------------------------------------------------------------
// Due Date & Birth Weight Pool
// ---------------------------------------------------------------------------

export type PoolActual = { date: string; time?: string | null; weightOz: number; lengthIn?: number | null };
export type PoolEntry = { name: string; date: string; time?: string | null; weightOz: number; lengthIn?: number | null };

/** Minutes between two "YYYY-MM-DD" dates, using times only when both are known. */
function minutesApart(aDate: string, aTime: string | null | undefined, bDate: string, bTime: string | null | undefined) {
  const useTime = Boolean(aTime && bTime);
  const a = Date.parse(`${aDate}T${useTime ? aTime : "00:00"}:00Z`);
  const b = Date.parse(`${bDate}T${useTime ? bTime : "00:00"}:00Z`);
  return Math.abs(a - b) / 60000;
}

export function scorePool<E extends PoolEntry>(actual: PoolActual, entries: E[]) {
  // `i` keys each entry, so two guests with the same name don't collide
  const withDiffs = entries.map((e, i) => ({
    ...e,
    i,
    dateOff: minutesApart(e.date, e.time, actual.date, actual.time),
    weightOff: Math.abs(e.weightOz - actual.weightOz),
    lengthOff: actual.lengthIn != null && e.lengthIn != null ? Math.abs(Number(e.lengthIn) - Number(actual.lengthIn)) : null,
  }));

  const datePlaces = new Map(placeBy(withDiffs, (r) => r.dateOff, "low").map((r) => [r.i, r.place]));
  const weightPlaces = new Map(placeBy(withDiffs, (r) => r.weightOff, "low").map((r) => [r.i, r.place]));
  const useLength = actual.lengthIn != null;
  const lengthPlaces = new Map(
    placeBy(withDiffs, (r) => (r.lengthOff == null ? Number.POSITIVE_INFINITY : r.lengthOff), "low").map((r) => [r.i, r.place]),
  );

  const overall = placeBy(
    withDiffs.map((r) => ({
      ...r,
      points: datePlaces.get(r.i)! + weightPlaces.get(r.i)! + (useLength ? lengthPlaces.get(r.i)! : 0),
    })),
    (r) => r.points,
    "low",
  );

  const winners = (key: "dateOff" | "weightOff" | "lengthOff") => {
    const vals = withDiffs.map((r) => r[key]).filter((v): v is number => v != null);
    if (!vals.length) return [];
    const best = Math.min(...vals);
    return withDiffs.filter((r) => r[key] === best).map((r) => r.name);
  };

  return {
    overall,
    closestDate: winners("dateOff"),
    closestWeight: winners("weightOff"),
    closestLength: useLength ? winners("lengthOff") : [],
  };
}

export function formatWeight(oz: number) {
  const lb = Math.floor(oz / 16);
  const rest = oz % 16;
  return `${lb} lb ${rest} oz`;
}

// ---------------------------------------------------------------------------
// Baby trivia
// ---------------------------------------------------------------------------

export type TriviaEntry = { name: string; answers: Record<string, number> };

/** Score against the host's current questions; `key` maps each question id to its right option. */
export function scoreTrivia<E extends TriviaEntry>(key: { id: string; answer: number }[], entries: E[]) {
  const rows = entries.map((e) => ({
    ...e,
    correct: key.filter((q) => e.answers[q.id] === q.answer).length,
    total: key.length,
  }));
  return placeBy(rows, (r) => r.correct, "high");
}
