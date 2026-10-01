import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGuestLines } from "../src/lib/guests.ts";

test("parses names with and without emails", () => {
  assert.deepEqual(
    parseGuestLines(
      "Aunt Mimi\nGrandpa Joe, Joe@Example.com\nTaylor <taylor@example.com>\nsam@example.com Sam Smith\nAnna, Ben; Cara\n\n",
    ),
    [
      { name: "Aunt Mimi", email: null },
      { name: "Grandpa Joe", email: "joe@example.com" },
      { name: "Taylor", email: "taylor@example.com" },
      { name: "Sam Smith", email: "sam@example.com" },
      { name: "Anna", email: null },
      { name: "Ben", email: null },
      { name: "Cara", email: null },
    ],
  );
});

test("an email on its own becomes a name too", () => {
  assert.deepEqual(parseGuestLines("lee@example.com"), [{ name: "lee", email: "lee@example.com" }]);
});
