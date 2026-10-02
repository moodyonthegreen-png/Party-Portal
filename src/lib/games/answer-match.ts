/**
 * Checking typed answers for open-ended games. Pure functions, so they can be
 * unit-tested. Forgiving on purpose: "A Joey!", "joeys" and "jowey" all count.
 */

/** Lowercase, no punctuation or accents, no leading "a", "an", "the" or "baby" */
export function normalizeAnswer(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:a|an|the|baby|its|it s|called)\s+)+/, "")
    .trim();
}

function singular(s: string) {
  if (s.length > 4 && s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.length > 4 && /(?:ch|sh|x|ss)es$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

/** Edit distance, stopping early once it's clearly more than `max` */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** One typo is fine for words of 5+ letters, two for 9+. Short words must be exact. */
export function answerMatches(typed: string, accepted: string[]): boolean {
  const t = singular(normalizeAnswer(typed));
  if (!t) return false;
  return accepted.some((raw) => {
    const a = singular(normalizeAnswer(raw));
    if (!a) return false;
    if (t === a) return true;
    const slack = a.length >= 9 ? 2 : a.length >= 5 ? 1 : 0;
    return slack > 0 && within(t, a, slack);
  });
}

export type TypedEntry = { name: string; answers: Record<string, string> };

/**
 * Score typed answers. `extra` holds answers the host chose to accept for
 * everyone. Ties share a place: 1, 2, 2, 4 …
 */
export function scoreTyped<E extends TypedEntry>(questions: { id: string; accepted: string[] }[], extra: Record<string, string[]>, entries: E[]) {
  const rows = entries.map((e) => {
    const right = questions.filter((q) => answerMatches(e.answers[q.id] ?? "", [...q.accepted, ...(extra[q.id] ?? [])])).map((q) => q.id);
    return { ...e, right, correct: right.length, total: questions.length };
  });
  rows.sort((a, b) => b.correct - a.correct);
  let place = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.correct !== prev) place = i + 1;
    prev = r.correct;
    return { ...r, place };
  });
}
