import { test } from "node:test";
import assert from "node:assert/strict";
import { draftThankYou, firstName, joinList, personKey } from "../src/lib/thanks-draft.ts";

test("joinList", () => {
  assert.equal(joinList(["a"]), "a");
  assert.equal(joinList(["a", "b"]), "a and b");
  assert.equal(joinList(["a", "b", "c"]), "a, b and c");
});

test("names", () => {
  assert.equal(firstName("Taylor Smith"), "Taylor");
  assert.equal(firstName("Aunt Mimi"), "Aunt Mimi");
  assert.equal(firstName("grandpa Joe Brown"), "grandpa Joe");
  assert.equal(personKey("  Aunt   MIMI "), "aunt mimi");
});

test("draft mentions gift and everything they did", () => {
  const text = draftThankYou({
    name: "Aunt Mimi",
    guestOfHonorName: "Jessica",
    contributions: { design: true, note: "audio", photos: 3, games: true },
    gift: "a stack of board books",
    signOff: "Jessie",
  });
  assert.match(text, /^Dear Aunt Mimi,/);
  assert.match(text, /We love the stack of board books\./);
  assert.match(text, /And we loved your design for Jessica's gift, your voice memo, the 3 photos you shared and playing along in the games\./);
  assert.match(text, /With love,\nJessie$/);
});

test("draft with nothing recorded is still friendly", () => {
  const text = draftThankYou({
    name: "Sam",
    guestOfHonorName: "Jessica",
    contributions: { design: false, note: null, photos: 0, games: false },
    gift: null,
    signOff: null,
  });
  assert.doesNotMatch(text, /loved/);
  assert.match(text, /With love,\nJessica$/);
});
