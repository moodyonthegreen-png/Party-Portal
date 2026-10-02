import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWeight, scoreBabyPhotos, scorePool } from "../src/lib/games/scoring.ts";

test("baby photos: counts correct guesses, case-insensitive, ties share a place", () => {
  const photos = [
    { id: "a", answer: "Jessica" },
    { id: "b", answer: "Grandpa Joe" },
    { id: "c", answer: "Sam" },
  ];
  const res = scoreBabyPhotos(photos, [
    { name: "Mimi", guesses: { a: "jessica", b: "grandpa  joe", c: "Taylor" } },
    { name: "Taylor", guesses: { a: "Jessica", b: "Grandpa Joe", c: "Sam" } },
    { name: "Sam", guesses: { a: "Sam", b: "Grandpa Joe", c: "Jessica" } },
    { name: "Joe", guesses: { a: "Jessica", b: "Grandpa Joe" } },
  ]);
  assert.deepEqual(
    res.map((r) => [r.name, r.correct, r.place]),
    [["Taylor", 3, 1], ["Mimi", 2, 2], ["Joe", 2, 2], ["Sam", 1, 4]],
  );
});

test("pool: closest date, weight and overall", () => {
  const actual = { date: "2026-11-02", time: "04:00", weightOz: 120, lengthIn: 20 };
  const res = scorePool(actual, [
    { name: "A", date: "2026-11-02", time: "06:00", weightOz: 112, lengthIn: 19 },
    { name: "B", date: "2026-11-05", time: null, weightOz: 121, lengthIn: 20 },
    { name: "C", date: "2026-10-30", time: "04:00", weightOz: 130, lengthIn: null },
  ]);
  assert.deepEqual(res.closestDate, ["A"]);
  assert.deepEqual(res.closestWeight, ["B"]);
  assert.deepEqual(res.closestLength, ["B"]);
  // Dates: A is 2 hours off; B and C are both 3 days off (tie for 2nd)
  // A: 1 + 2 + 2 = 5; B: 2 + 1 + 1 = 4; C: 2 + 3 + 3 (no length guess) = 8
  assert.deepEqual(res.overall.map((r) => [r.name, r.points, r.place]), [["B", 4, 1], ["A", 5, 2], ["C", 8, 3]]);
});

test("pool: without a length, only date and weight count", () => {
  const res = scorePool({ date: "2026-11-02", weightOz: 120 }, [
    { name: "A", date: "2026-11-01", weightOz: 120 },
    { name: "B", date: "2026-11-02", weightOz: 110 },
  ]);
  assert.deepEqual(res.closestLength, []);
  assert.equal(res.overall[0].place, 1);
  assert.equal(res.overall[1].place, 1);
});

test("weight formatting", () => {
  assert.equal(formatWeight(118), "7 lb 6 oz");
  assert.equal(formatWeight(128), "8 lb 0 oz");
});

test("trivia: scores against the current questions, ties share a place", async () => {
  const { scoreTrivia } = await import("../src/lib/games/scoring.ts");
  const key = [
    { id: "a", answer: 1 },
    { id: "b", answer: 0 },
    { id: "c", answer: 2 },
  ];
  const res = scoreTrivia(key, [
    { name: "Mimi", answers: { a: 1, b: 0, c: 2 } },
    { name: "Joe", answers: { a: 1, b: 3, c: 2, gone: 1 } },
    { name: "Sam", answers: { a: 1, b: 0, c: 0 } },
    { name: "Kay", answers: {} },
  ]);
  assert.deepEqual(res.map((r) => [r.name, r.correct, r.total, r.place]), [
    ["Mimi", 3, 3, 1],
    ["Joe", 2, 3, 2],
    ["Sam", 2, 3, 2],
    ["Kay", 0, 3, 4],
  ]);
});

test("trivia: settings keep only real questions, in order, without repeats", async () => {
  const { parseGames } = await import("../src/lib/games/settings.ts");
  const { DEFAULT_TRIVIA } = await import("../src/lib/games/settings.ts");
  const { TRIVIA_BANK, triviaQuestions } = await import("../src/lib/games/trivia-bank.ts");
  assert.deepEqual(parseGames({}).trivia.questions, DEFAULT_TRIVIA);
  assert.deepEqual(parseGames({ trivia: { on: true, questions: ["joey", "nope", "joey", "bones", 5] } }).trivia.questions, ["joey", "nope", "bones"]);
  assert.deepEqual(triviaQuestions(["joey", "nope", "bones"]).map((q) => q.id), ["joey", "bones"]);
  for (const q of TRIVIA_BANK) {
    assert.ok(q.answer >= 0 && q.answer < q.options.length, q.id);
    assert.equal(new Set(q.options).size, q.options.length, q.id);
  }
  assert.equal(new Set(TRIVIA_BANK.map((q) => q.id)).size, TRIVIA_BANK.length);
  for (const id of DEFAULT_TRIVIA) assert.ok(TRIVIA_BANK.some((q) => q.id === id), id);
});
