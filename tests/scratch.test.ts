import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWinningCard } from "../src/lib/games/scratch-rules.ts";

test("winning card is between the next card and the expected count", () => {
  assert.equal(pickWinningCard(0, 20, () => 0), 1);
  assert.equal(pickWinningCard(0, 20, () => 0.999999), 20);
  assert.equal(pickWinningCard(5, 20, () => 0), 6);
  assert.equal(pickWinningCard(5, 20, () => 0.999999), 20);
  for (let i = 0; i < 200; i++) {
    const n = pickWinningCard(3, 12, Math.random);
    assert.ok(n >= 4 && n <= 12, String(n));
  }
});

test("more players than expected: the next card wins", () => {
  assert.equal(pickWinningCard(25, 20, () => 0.7), 26);
  assert.equal(pickWinningCard(0, 1, () => 0.5), 1);
});
