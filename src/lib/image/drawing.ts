/**
 * Turns a phone photo of a drawing card into a clean, transparent design.
 *
 * Pure pixel code (no DOM) so it can be unit-tested in Node. The browser
 * wrapper in ./browser.ts handles loading files and canvases.
 *
 * Pipeline
 *  1. Estimate the paper colour across the image in coarse blocks. This
 *     "flat-field" removes shadows and uneven lighting.
 *  2. Find the card: the largest connected region of bright blocks. Anything
 *     outside it (table, lap, carpet) is dropped.
 *  3. For each pixel inside the card, measure how far it is from the local
 *     paper colour (darkness + colourfulness) and turn that into opacity.
 *  4. Crop to the inked area with a little padding.
 *  5. Un-mix the white paper out of the colours so strokes stay vivid on any
 *     background colour.
 *  6. Measure sharpness so we can warn about blurry photos.
 */

export type RGBAImage = { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number };

export type Rect = { x: number; y: number; w: number; h: number };

export type ProcessResult = {
  image: RGBAImage;
  /** Where the crop came from, in the input image's coordinates */
  crop: Rect;
  /** Higher is sharper (contrast-normalised). See BLUR_WARN_BELOW. */
  sharpness: number;
  /** Share of the cropped area that is ink, 0..1 */
  inkCoverage: number;
  warnings: Warning[];
};

export type Warning = "blurry" | "no-drawing" | "faint" | "card-not-found";

// Tunable thresholds. Adjust after testing with real photos.
export const BLUR_WARN_BELOW = 1.8;
const INK_LO = 26; // ink strength where a pixel starts to become visible
const INK_HI = 92; // ink strength where a pixel is fully opaque
const CROP_PAD = 0.04;

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function smoothstep(lo: number, hi: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// 1. Paper colour per block
// ---------------------------------------------------------------------------

type PaperField = {
  bw: number; // block size in px
  cols: number;
  rows: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  l: Float32Array;
};

/** For each block, average the brightest ~20% of pixels: that's the paper there. */
export function estimatePaper(img: RGBAImage): PaperField {
  const { width, height, data } = img;
  const bw = Math.max(12, Math.round(Math.max(width, height) / 48));
  const cols = Math.ceil(width / bw);
  const rows = Math.ceil(height / bw);
  const r = new Float32Array(cols * rows);
  const g = new Float32Array(cols * rows);
  const b = new Float32Array(cols * rows);
  const l = new Float32Array(cols * rows);
  const hist = new Uint32Array(256);

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const x0 = bx * bw, y0 = by * bw;
      const x1 = Math.min(width, x0 + bw), y1 = Math.min(height, y0 + bw);
      hist.fill(0);
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          hist[Math.round(lum(data[i], data[i + 1], data[i + 2]))]++;
          n++;
        }
      }
      // Luminance cut-off for the top 20%
      let acc = 0, cut = 255;
      for (let v = 255; v >= 0; v--) {
        acc += hist[v];
        if (acc >= n * 0.2) { cut = v; break; }
      }
      let sr = 0, sg = 0, sb = 0, sn = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 4;
          if (Math.round(lum(data[i], data[i + 1], data[i + 2])) >= cut) {
            sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; sn++;
          }
        }
      }
      const k = by * cols + bx;
      const d = Math.max(1, sn);
      r[k] = sr / d; g[k] = sg / d; b[k] = sb / d;
      l[k] = lum(r[k], g[k], b[k]);
    }
  }

  return { bw, cols, rows, r, g, b, l };
}

/**
 * Large coloured-in areas cover whole blocks, so those blocks look like
 * "dark paper" and the colouring would vanish. Fix that with a morphological
 * closing over the card: first take the brightest block nearby (dilate), then
 * the darkest of those (erode). Drawn areas up to about a third of the card
 * get replaced by the surrounding paper, while slow lighting changes such as
 * a shadow across the card survive. Runs after card detection so the table
 * around the card never counts as paper.
 */
export function fillInkedBlocks(f: PaperField, card: Rect) {
  const bx0 = Math.floor(card.x / f.bw), by0 = Math.floor(card.y / f.bw);
  const bx1 = Math.ceil((card.x + card.w) / f.bw) - 1, by1 = Math.ceil((card.y + card.h) / f.bw) - 1;
  const R = Math.max(2, Math.ceil(Math.max(bx1 - bx0 + 1, by1 - by0 + 1) / 6));

  const pass = (pick: (cand: number, best: number) => boolean) => {
    const src = { r: f.r.slice(), g: f.g.slice(), b: f.b.slice(), l: f.l.slice() };
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        let best = by * f.cols + bx;
        for (let ny = Math.max(by0, by - R); ny <= Math.min(by1, by + R); ny++) {
          for (let nx = Math.max(bx0, bx - R); nx <= Math.min(bx1, bx + R); nx++) {
            const k = ny * f.cols + nx;
            if (pick(src.l[k], src.l[best])) best = k;
          }
        }
        const k = by * f.cols + bx;
        f.r[k] = src.r[best]; f.g[k] = src.g[best]; f.b[k] = src.b[best]; f.l[k] = src.l[best];
      }
    }
  };
  pass((c, b) => c > b); // dilate: brightest nearby
  pass((c, b) => c < b); // erode: darkest of those
}

/** Bilinear lookup of the paper colour at a pixel. */
function paperAt(f: PaperField, x: number, y: number, out: number[]) {
  const fx = Math.min(f.cols - 1, Math.max(0, x / f.bw - 0.5));
  const fy = Math.min(f.rows - 1, Math.max(0, y / f.bw - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const x1 = Math.min(f.cols - 1, x0 + 1), y1 = Math.min(f.rows - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const k00 = y0 * f.cols + x0, k10 = y0 * f.cols + x1, k01 = y1 * f.cols + x0, k11 = y1 * f.cols + x1;
  const mix = (a: Float32Array) =>
    (a[k00] * (1 - tx) + a[k10] * tx) * (1 - ty) + (a[k01] * (1 - tx) + a[k11] * tx) * ty;
  out[0] = mix(f.r); out[1] = mix(f.g); out[2] = mix(f.b);
}

// ---------------------------------------------------------------------------
// 2. Find the card
// ---------------------------------------------------------------------------

/** Otsu's threshold on block paper-luminance values. */
function otsu(values: Float32Array): { threshold: number; separation: number } {
  const hist = new Float64Array(256);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  // Mean gap between the two classes, used to decide if there is a background at all
  let lo = 0, loN = 0, hi = 0, hiN = 0;
  for (const v of values) {
    if (Math.round(v) <= threshold) { lo += v; loN++; } else { hi += v; hiN++; }
  }
  const separation = loN && hiN ? hi / hiN - lo / loN : 0;
  return { threshold, separation };
}

export function findCard(img: RGBAImage, f: PaperField): Rect | null {
  const { threshold, separation } = otsu(f.l);
  // Whole frame is card: nothing to remove
  if (separation < 45) return { x: 0, y: 0, w: img.width, h: img.height };

  const bright = new Uint8Array(f.cols * f.rows);
  for (let k = 0; k < bright.length; k++) bright[k] = Math.round(f.l[k]) > threshold ? 1 : 0;

  // Largest 4-connected bright component
  const label = new Int32Array(bright.length).fill(-1);
  let bestSize = 0;
  let bestLabel = -1;
  let bestBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const stack: number[] = [];
  for (let start = 0; start < bright.length; start++) {
    if (!bright[start] || label[start] !== -1) continue;
    label[start] = start;
    stack.push(start);
    let size = 0, x0 = f.cols, y0 = f.rows, x1 = 0, y1 = 0;
    while (stack.length) {
      const k = stack.pop()!;
      size++;
      const bx = k % f.cols, by = (k / f.cols) | 0;
      x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
      const nbrs = [bx > 0 ? k - 1 : -1, bx < f.cols - 1 ? k + 1 : -1, by > 0 ? k - f.cols : -1, by < f.rows - 1 ? k + f.cols : -1];
      for (const nk of nbrs) {
        if (nk >= 0 && bright[nk] && label[nk] === -1) { label[nk] = start; stack.push(nk); }
      }
    }
    if (size > bestSize) { bestSize = size; bestBox = { x0, y0, x1, y1 }; bestLabel = start; }
  }

  if (bestSize < bright.length * 0.08) return null;

  // A real card edge is abrupt; a shadow falling across the card is gradual.
  // Compare each boundary block with the block two steps further out. If the
  // typical jump is small, the "dark part" is just shadowed card: keep it all.
  const jumps: number[] = [];
  for (let k = 0; k < bright.length; k++) {
    if (label[k] !== bestLabel) continue;
    const bx = k % f.cols, by = (k / f.cols) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = bx + dx, ay = by + dy;
      if (ax < 0 || ay < 0 || ax >= f.cols || ay >= f.rows) continue;
      if (label[ay * f.cols + ax] === bestLabel) continue;
      const ox = bx + 2 * dx, oy = by + 2 * dy;
      if (ox < 0 || oy < 0 || ox >= f.cols || oy >= f.rows) continue;
      jumps.push(f.l[k] - f.l[oy * f.cols + ox]);
    }
  }
  jumps.sort((p, q) => p - q);
  const medianJump = jumps.length ? jumps[jumps.length >> 1] : 0;
  if (medianJump < 30) return { x: 0, y: 0, w: img.width, h: img.height };

  // Convert to pixels and trim the edge so the card's border and shadow aren't treated as ink
  // Blocks on the boundary mix card and table, so pull in by two blocks
  const inset = 2 * f.bw;
  const x = Math.min(img.width - 1, bestBox.x0 * f.bw + inset);
  const y = Math.min(img.height - 1, bestBox.y0 * f.bw + inset);
  const xEnd = Math.max(x + 1, Math.min(img.width, (bestBox.x1 + 1) * f.bw - inset));
  const yEnd = Math.max(y + 1, Math.min(img.height, (bestBox.y1 + 1) * f.bw - inset));
  return { x, y, w: xEnd - x, h: yEnd - y };
}

// ---------------------------------------------------------------------------
// 3-5. Ink opacity, crop, un-mix
// ---------------------------------------------------------------------------

/** 0..255 ink strength: how far a pixel is from its local paper colour. */
function inkStrength(r: number, g: number, b: number, pr: number, pg: number, pb: number) {
  // Flat-field: scale so local paper becomes pure white
  const nr = Math.min(255, (r * 255) / Math.max(1, pr));
  const ng = Math.min(255, (g * 255) / Math.max(1, pg));
  const nb = Math.min(255, (b * 255) / Math.max(1, pb));
  const darkness = 255 - lum(nr, ng, nb);
  const chroma = Math.max(nr, ng, nb) - Math.min(nr, ng, nb);
  return { s: Math.max(darkness, chroma * 1.25), nr, ng, nb };
}

export function processDrawing(img: RGBAImage): ProcessResult {
  const warnings: Warning[] = [];
  const field = estimatePaper(img);
  let card = findCard(img, field);
  if (!card) {
    warnings.push("card-not-found");
    card = { x: 0, y: 0, w: img.width, h: img.height };
  }
  fillInkedBlocks(field, card);

  const { data, width } = img;
  const alpha = new Uint8ClampedArray(card.w * card.h);
  const rgb = new Uint8ClampedArray(card.w * card.h * 3);
  const colCount = new Uint32Array(card.w);
  const rowCount = new Uint32Array(card.h);
  const paper = [0, 0, 0];
  let inkPixels = 0;

  for (let y = 0; y < card.h; y++) {
    for (let x = 0; x < card.w; x++) {
      const sx = card.x + x, sy = card.y + y;
      const i = (sy * width + sx) * 4;
      paperAt(field, sx, sy, paper);
      const { s, nr, ng, nb } = inkStrength(data[i], data[i + 1], data[i + 2], paper[0], paper[1], paper[2]);
      const a = smoothstep(INK_LO, INK_HI, s);
      const k = y * card.w + x;
      alpha[k] = Math.round(a * 255);
      if (a > 0) {
        // Un-mix white: observed = a*colour + (1-a)*white
        const inv = 1 / Math.max(a, 0.05);
        rgb[k * 3] = Math.max(0, Math.min(255, (nr - 255 * (1 - a)) * inv));
        rgb[k * 3 + 1] = Math.max(0, Math.min(255, (ng - 255 * (1 - a)) * inv));
        rgb[k * 3 + 2] = Math.max(0, Math.min(255, (nb - 255 * (1 - a)) * inv));
      }
      if (a > 0.35) {
        colCount[x]++; rowCount[y]++; inkPixels++;
      }
    }
  }

  // Crop to rows/columns with meaningful ink, ignoring specks
  const minCol = Math.max(2, Math.round(card.h * 0.004));
  const minRow = Math.max(2, Math.round(card.w * 0.004));
  let cx0 = 0, cx1 = card.w - 1, cy0 = 0, cy1 = card.h - 1;
  while (cx0 < card.w && colCount[cx0] < minCol) cx0++;
  while (cx1 > cx0 && colCount[cx1] < minCol) cx1--;
  while (cy0 < card.h && rowCount[cy0] < minRow) cy0++;
  while (cy1 > cy0 && rowCount[cy1] < minRow) cy1--;

  if (cx0 >= card.w || cy0 >= card.h || inkPixels < card.w * card.h * 0.001) {
    warnings.push("no-drawing");
    cx0 = 0; cy0 = 0; cx1 = card.w - 1; cy1 = card.h - 1;
  }

  const pad = Math.round(Math.max(cx1 - cx0, cy1 - cy0) * CROP_PAD);
  cx0 = Math.max(0, cx0 - pad); cy0 = Math.max(0, cy0 - pad);
  cx1 = Math.min(card.w - 1, cx1 + pad); cy1 = Math.min(card.h - 1, cy1 + pad);

  const ow = cx1 - cx0 + 1, oh = cy1 - cy0 + 1;
  const out = new Uint8ClampedArray(ow * oh * 4);
  let alphaSum = 0;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const k = (cy0 + y) * card.w + (cx0 + x);
      const o = (y * ow + x) * 4;
      out[o] = rgb[k * 3]; out[o + 1] = rgb[k * 3 + 1]; out[o + 2] = rgb[k * 3 + 2];
      out[o + 3] = alpha[k];
      alphaSum += alpha[k];
    }
  }

  const inkCoverage = alphaSum / 255 / (ow * oh);
  if (!warnings.includes("no-drawing") && inkCoverage < 0.01) warnings.push("faint");

  const crop = { x: card.x + cx0, y: card.y + cy0, w: ow, h: oh };
  const sharpness = measureSharpness(img, crop);
  if (!warnings.includes("no-drawing") && sharpness < BLUR_WARN_BELOW) warnings.push("blurry");

  return { image: { data: out, width: ow, height: oh }, crop, sharpness, inkCoverage, warnings };
}

// ---------------------------------------------------------------------------
// 6. Sharpness
// ---------------------------------------------------------------------------

/**
 * Sharpness = 90th-percentile Sobel gradient among edge pixels in the crop.
 * Looking only at edges (gradient above the paper-noise floor) keeps sparse
 * drawings from looking "blurry" just because most of the card is blank.
 * The result is divided by the drawing's contrast, so it reads the same for
 * pencil and marker. Crisp edges score around 3 or more; out-of-focus or
 * shaky photos smear each edge over several pixels and score below ~1.5.
 */
export function measureSharpness(img: RGBAImage, r: Rect): number {
  const { data, width } = img;
  const w = r.w, h = r.h;
  if (w < 3 || h < 3) return 0;
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((r.y + y) * width + (r.x + x)) * 4;
      gray[y * w + x] = lum(data[i], data[i + 1], data[i + 2]);
    }
  }
  const NOISE_FLOOR = 40;
  const hist = new Uint32Array(1100);
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      const gx = gray[k - w + 1] + 2 * gray[k + 1] + gray[k + w + 1] - gray[k - w - 1] - 2 * gray[k - 1] - gray[k + w - 1];
      const gy = gray[k + w - 1] + 2 * gray[k + w] + gray[k + w + 1] - gray[k - w - 1] - 2 * gray[k - w] - gray[k - w + 1];
      const m = Math.hypot(gx, gy);
      if (m < NOISE_FLOOR) continue;
      hist[Math.min(1099, Math.round(m))]++;
      n++;
    }
  }
  // Too few edges to judge: don't warn
  if (n < 50) return Number.POSITIVE_INFINITY;
  let acc = 0, p90 = 0;
  for (let v = 1099; v >= 0; v--) {
    acc += hist[v];
    if (acc >= n * 0.1) { p90 = v; break; }
  }
  // Divide by the drawing's contrast so faint pencil isn't judged against bold marker
  const sorted = Float32Array.from(gray).sort();
  const contrast = sorted[Math.floor(sorted.length * 0.995)] - sorted[Math.floor(sorted.length * 0.005)];
  return contrast < 20 ? Number.POSITIVE_INFINITY : p90 / contrast;
}
