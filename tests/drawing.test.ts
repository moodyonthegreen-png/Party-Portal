// Run with: npm test
// Synthetic "photos" of drawing cards, checked against processDrawing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { processDrawing, type RGBAImage } from "../src/lib/image/drawing.ts";

type Opts = { table?: boolean; shadow?: boolean; blur?: number; fill?: boolean };

/** 1200x900 photo: optional brown table around the card, a dark ring, optional big red fill. */
function photo({ table = false, shadow = false, blur = 0, fill = true }: Opts): RGBAImage {
  const W = 1200, H = 900;
  const d = new Uint8ClampedArray(W * H * 4);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const onCard = !table || (x > W * 0.15 && x < W * 0.85 && y > H * 0.12 && y < H * 0.88);
      const sh = shadow ? 1 - 0.35 * (x / W) : 1;
      let r = 110, g = 80, b = 55;
      if (onCard) { r = 245 * sh; g = 240 * sh; b = 230 * sh; }
      const rr = Math.hypot(x - W / 2, y - H / 2);
      if (onCard && Math.abs(rr - W * 0.18) < 3) { r = 30 * sh; g = 30 * sh; b = 40 * sh; }
      if (fill && onCard && x > 500 && x < 700 && y > 350 && y < 550) { r = 200 * sh; g = 40 * sh; b = 50 * sh; }
      d[i] = r + rand() * 6 - 3; d[i + 1] = g + rand() * 6 - 3; d[i + 2] = b + rand() * 6 - 3; d[i + 3] = 255;
    }
  }
  for (let p = 0; p < blur; p++) {
    const s = d.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) for (let c = 0; c < 3; c++) {
      let a = 0;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) a += s[((y + j) * W + x + k) * 4 + c];
      d[(y * W + x) * 4 + c] = a / 9;
    }
  }
  return { data: d, width: W, height: H };
}

function pixel(r: ReturnType<typeof processDrawing>, x: number, y: number) {
  const o = ((y - r.crop.y) * r.image.width + (x - r.crop.x)) * 4;
  return Array.from(r.image.data.slice(o, o + 4));
}

// The ring spans 384..816 x 234..666; expect a tight crop around it.
const ringInside = (r: ReturnType<typeof processDrawing>) =>
  r.crop.x > 340 && r.crop.x <= 384 && r.crop.y > 190 && r.crop.y <= 234 &&
  r.crop.x + r.crop.w >= 816 && r.crop.x + r.crop.w < 860;

test("crops tightly to the drawing on a plain card", () => {
  const r = processDrawing(photo({}));
  assert.ok(ringInside(r), JSON.stringify(r.crop));
  assert.deepEqual(r.warnings, []);
});

test("removes the table around the card and survives a shadow", () => {
  const r = processDrawing(photo({ table: true, shadow: true }));
  assert.ok(ringInside(r), JSON.stringify(r.crop));
  assert.equal(r.image.data[3], 0, "corner should be transparent");
  assert.deepEqual(r.warnings, []);
});

test("keeps large coloured-in areas, with true colour, even in shadow", () => {
  const r = processDrawing(photo({ shadow: true }));
  const [red, green, blue, alpha] = pixel(r, 650, 450);
  assert.equal(alpha, 255);
  assert.ok(red > 170 && green < 70 && blue < 80, `got ${red},${green},${blue}`);
});

test("blank paper becomes fully transparent", () => {
  const r = processDrawing(photo({ fill: false }));
  assert.equal(pixel(r, 600, 450)[3], 0);
});

test("flags a blurry photo but not a sharp one", () => {
  assert.ok(!processDrawing(photo({ table: true })).warnings.includes("blurry"));
  assert.ok(processDrawing(photo({ table: true, blur: 8 })).warnings.includes("blurry"));
});

test("warns when there is no drawing", () => {
  const W = 400, H = 300;
  const blank = { data: new Uint8ClampedArray(W * H * 4).fill(240), width: W, height: H };
  assert.ok(processDrawing(blank).warnings.includes("no-drawing"));
});
