import { test } from "node:test";
import assert from "node:assert/strict";
import { drawEntrant, raffleEntrants } from "../src/lib/games/raffle.ts";
import { parseGames } from "../src/lib/games/settings.ts";

const people = [
  { key: "mimi", name: "Aunt Mimi", contributions: { design: true, note: "text", photos: 2, games: true } },
  { key: "joe", name: "Grandpa Joe", contributions: { design: true, note: null, photos: 0, games: false } },
  { key: "sam", name: "Sam", contributions: { design: false, note: "audio", photos: 0, games: false } },
];

test("only the chosen activities earn entries", () => {
  const e = raffleEntrants(people, { design: true, note: false, photos: false, games: false });
  assert.deepEqual(e.map((x) => [x.key, x.entries]), [["mimi", 1], ["joe", 1]]);
});

test("each activity is one entry", () => {
  const e = raffleEntrants(people, { design: true, note: true, photos: true, games: true });
  assert.deepEqual(e.map((x) => [x.key, x.entries]), [["mimi", 4], ["joe", 1], ["sam", 1]]);
});

test("draw is weighted by entries and skips past winners", () => {
  const e = raffleEntrants(people, { design: true, note: true, photos: true, games: true });
  // 6 tickets: mimi 0-3, joe 4, sam 5
  assert.equal(drawEntrant(e, new Set(), () => 0)!.key, "mimi");
  assert.equal(drawEntrant(e, new Set(), () => 3.9 / 6)!.key, "mimi");
  assert.equal(drawEntrant(e, new Set(), () => 4.5 / 6)!.key, "joe");
  assert.equal(drawEntrant(e, new Set(), () => 0.999)!.key, "sam");
  assert.equal(drawEntrant(e, new Set(["mimi"]), () => 0)!.key, "joe");
  assert.equal(drawEntrant(e, new Set(["mimi", "joe", "sam"]), () => 0), null);
});

test("older parties without raffle settings get safe defaults", () => {
  const g = parseGames({ babyPhotos: { on: false } });
  assert.equal(g.raffle.on, false);
  assert.deepEqual(g.raffle.prizes, []);
  assert.equal(g.raffle.rules.design, true);
  const g2 = parseGames({ raffle: { on: true, prizes: ["$25 card", 7], winners: [{ name: "Sam", key: "sam", prize: "$25 card" }] } });
  assert.deepEqual(g2.raffle.prizes, ["$25 card"]);
  assert.equal(g2.raffle.winners[0]?.name, "Sam");
});

test("game prizes default to off and keep who was emailed", () => {
  const g = parseGames({});
  assert.deepEqual(g.babyPhotos.prize, { on: false, prize: "", emailed: {} });
  const g2 = parseGames({ pool: { on: true, prize: { on: true, prize: "$20 card", emailed: { "aunt mimi": "2026-10-01T00:00:00Z", bad: 3 } } } });
  assert.equal(g2.pool.prize.on, true);
  assert.equal(g2.pool.prize.prize, "$20 card");
  assert.deepEqual(Object.keys(g2.pool.prize.emailed), ["aunt mimi"]);
  assert.equal(g2.pool.on, true);
});
