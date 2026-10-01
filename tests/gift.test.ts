import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveDpi, outsideSafe, sanitizeLayout, scatter, snapPosition, type DesignEl } from "../src/lib/gift/layout.ts";

test("scatter keeps every design inside the safe zone and spread out", () => {
  for (const n of [1, 5, 12, 30]) {
    for (const areaAspect of [1, 4 / 3]) {
      const designs = Array.from({ length: n }, (_, i) => ({ designId: `g${i}`, aspect: i % 3 === 0 ? 1.3 : 0.8 }));
      const els = scatter(designs, { areaAspect, inset: 0.04, seed: 3 });
      assert.equal(els.length, n);
      for (const e of els) {
        assert.ok(!outsideSafe(e, areaAspect, 0.02), `n=${n} aspect=${areaAspect} ${JSON.stringify(e)}`);
        assert.ok(Math.abs(e.rot) <= 8);
      }
      // No two centres on top of each other
      for (let i = 0; i < els.length; i++)
        for (let j = i + 1; j < els.length; j++)
          assert.ok(Math.hypot(els[i].x - els[j].x, els[i].y - els[j].y) > 0.05);
    }
  }
});

test("scatter is repeatable for the same seed", () => {
  const d = [{ designId: "a", aspect: 1 }, { designId: "b", aspect: 1 }];
  assert.deepEqual(scatter(d, { areaAspect: 1, inset: 0.05, seed: 9 }), scatter(d, { areaAspect: 1, inset: 0.05, seed: 9 }));
});

test("outsideSafe catches a rotated corner poking out", () => {
  const el: DesignEl = { id: "1", kind: "design", designId: "a", aspect: 1, x: 0.5, y: 0.5, w: 0.8, rot: 0 };
  assert.equal(outsideSafe(el, 1, 0.05), false);
  assert.equal(outsideSafe({ ...el, rot: 45 }, 1, 0.05), true);
  assert.equal(outsideSafe({ ...el, x: 0.12, w: 0.2 }, 1, 0.05), true);
});

test("effective dpi", () => {
  const el: DesignEl = { id: "1", kind: "design", designId: "a", aspect: 1, x: 0.5, y: 0.5, w: 0.25, rot: 0 };
  // 1500 px image across a quarter of a 30 in print = 7.5 in -> 200 dpi
  assert.equal(effectiveDpi(el, 1500, 30), 200);
});

test("snapping to centre and to other elements", () => {
  assert.deepEqual(snapPosition(0.505, 0.3, []), { x: 0.5, y: 0.3, guides: [{ axis: "x", at: 0.5 }] });
  const s = snapPosition(0.2, 0.705, [{ x: 0.8, y: 0.7 }]);
  assert.equal(s.y, 0.7);
  assert.equal(s.x, 0.2);
});

test("sanitizeLayout drops junk and clamps values", () => {
  const l = sanitizeLayout({
    background: "red",
    elements: [
      { kind: "design", designId: "x", x: 9, y: 0.5, w: 0.2, rot: 0, aspect: 1 },
      { kind: "text", text: "Hi", color: "javascript:", x: 0.5, y: 0.5, w: 0.3, rot: 0, size: 0.05 },
      { kind: "evil" },
    ],
  });
  assert.equal(l.background, "#ffffff");
  assert.equal(l.elements.length, 2);
  assert.equal(l.elements[0].x, 1.5);
  assert.equal((l.elements[1] as { color: string }).color, "#3b4836");
});
