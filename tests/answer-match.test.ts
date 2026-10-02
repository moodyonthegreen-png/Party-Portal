import { test } from "node:test";
import assert from "node:assert/strict";
import { answerMatches, normalizeAnswer } from "../src/lib/games/answer-match.ts";
import { ANIMAL_BABIES, animalQuestions } from "../src/lib/games/animal-babies.ts";

test("normalizes articles, punctuation, case and accents", () => {
  assert.equal(normalizeAnswer("  A Joey!! "), "joey");
  assert.equal(normalizeAnswer("the baby Cygnet"), "cygnet");
  assert.equal(normalizeAnswer("It's called a puggle."), "puggle");
  assert.equal(normalizeAnswer("Crìa"), "cria");
});

test("forgiving matches", () => {
  assert.ok(answerMatches("joeys", ["joey"]));
  assert.ok(answerMatches("A cignet", ["cygnet"]));
  assert.ok(answerMatches("Ducklings", ["duckling"]));
  assert.ok(answerMatches("caterpiller", ["caterpillar", "larva"]));
  assert.ok(answerMatches("fillies", ["foal", "colt", "filly"]));
  assert.ok(answerMatches("spiderlings", ["spiderling"]));
});

test("short words must be exact, wrong answers fail", () => {
  assert.ok(!answerMatches("cat", ["cub"]));
  assert.ok(!answerMatches("kits", ["kid"]));
  assert.ok(answerMatches("kid", ["kid"]));
  assert.ok(!answerMatches("", ["joey"]));
  assert.ok(!answerMatches("baby", ["joey"]));
  assert.ok(!answerMatches("calf", ["cub"]));
  assert.ok(!answerMatches("piglet", ["hoglet"]));
});

test("bank is well formed", () => {
  assert.equal(new Set(ANIMAL_BABIES.map((q) => q.id)).size, ANIMAL_BABIES.length);
  for (const q of ANIMAL_BABIES) {
    assert.ok(q.accepted.length > 0, q.id);
    for (const a of q.accepted) assert.ok(answerMatches(a, q.accepted), `${q.id}: ${a}`);
  }
  assert.deepEqual(animalQuestions(["swan", "nope", "owl"]).map((q) => q.id), ["swan", "owl"]);
});

test("scoring typed answers, with host-accepted extras", async () => {
  const { scoreTyped } = await import("../src/lib/games/answer-match.ts");
  const qs = [
    { id: "rabbit", accepted: ["kit"] },
    { id: "owl", accepted: ["owlet"] },
  ];
  const entries = [
    { name: "A", answers: { rabbit: "bunny", owl: "owlett" } },
    { name: "B", answers: { rabbit: "kit", owl: "chick" } },
    { name: "C", answers: {} },
  ];
  assert.deepEqual(scoreTyped(qs, {}, entries).map((r) => [r.name, r.correct, r.place]), [["A", 1, 1], ["B", 1, 1], ["C", 0, 3]]);
  assert.deepEqual(scoreTyped(qs, { rabbit: ["bunny"] }, entries).map((r) => [r.name, r.correct, r.place]), [["A", 2, 1], ["B", 1, 2], ["C", 0, 3]]);
});
