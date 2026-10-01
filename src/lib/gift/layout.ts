/**
 * Layout model and maths for the group-gift collage. Pure functions so they
 * can be tested without a browser.
 *
 * Positions are fractions of the print area: x and y are the element's
 * centre (0..1 across and down), w is its width as a share of the print
 * width. Heights come from each element's aspect ratio (height / width).
 */

export type DesignEl = {
  id: string;
  kind: "design";
  designId: string;
  /** height / width of the image */
  aspect: number;
  x: number;
  y: number;
  w: number;
  rot: number;
};

export type TextEl = {
  id: string;
  kind: "text";
  text: string;
  font: "script" | "serif";
  color: string;
  x: number;
  y: number;
  w: number;
  rot: number;
  /** Font size as a share of the print width */
  size: number;
};

export type El = DesignEl | TextEl;

export type Layout = {
  version: 1;
  background: string;
  snap: boolean;
  /** Painted bottom to top */
  elements: El[];
};

export const EMPTY_LAYOUT: Layout = { version: 1, background: "#ffffff", snap: true, elements: [] };

/** Seeded random, so "Scatter for me" gives the same layout for the same seed. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Element height as a share of the print height. */
export function heightFrac(el: El, areaAspect: number) {
  // areaAspect = print height / print width
  const aspect = el.kind === "design" ? el.aspect : textAspect(el);
  return (el.w * aspect) / areaAspect;
}

/** Rough text box aspect (height / width), good enough for layout and hit areas. */
export function textAspect(el: TextEl) {
  const chars = Math.max(1, el.text.length);
  const widthPerChar = el.font === "script" ? 0.42 : 0.55;
  const boxW = chars * widthPerChar * el.size;
  return (el.size * 1.3) / Math.max(boxW, 0.0001);
}

/**
 * Starting layout: designs in a loose grid that fills the safe area, each
 * slightly turned and nudged so it looks hand-placed.
 */
export function scatter(
  designs: { designId: string; aspect: number }[],
  opts: { areaAspect: number; inset: number; seed?: number },
): DesignEl[] {
  const n = designs.length;
  if (!n) return [];
  const rand = rng(opts.seed ?? 7);
  const usableW = 1 - opts.inset * 2;
  const usableH = 1 - (opts.inset * 2) / opts.areaAspect;
  // Columns so cells come out roughly square on the real product
  const physicalRatio = (usableH * opts.areaAspect) / usableW;
  const cols = Math.max(1, Math.round(Math.sqrt(n / physicalRatio)));
  const rows = Math.ceil(n / cols);
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  return designs.map((d, i) => {
    const r = Math.floor(i / cols);
    // Centre a short last row
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const c = i % cols;
    const rowOffset = ((cols - inRow) * cellW) / 2;
    const cx = opts.inset + rowOffset + cellW * (c + 0.5);
    const cy = opts.inset / opts.areaAspect + cellH * (r + 0.5);

    // Fit inside the cell (in physical units), leaving breathing room
    const cellPhysW = cellW;
    const cellPhysH = cellH * opts.areaAspect;
    const fit = Math.min(cellPhysW, cellPhysH / d.aspect) * 0.82;

    return {
      id: `d-${d.designId}`,
      kind: "design",
      designId: d.designId,
      aspect: d.aspect,
      x: cx + (rand() - 0.5) * cellW * 0.12,
      y: cy + (rand() - 0.5) * cellH * 0.12,
      w: fit,
      rot: Math.round((rand() - 0.5) * 16),
    };
  });
}

/** Corners of an element's rotated box, as fractions of the print area. */
export function corners(el: El, areaAspect: number) {
  const hw = el.w / 2;
  const hh = heightFrac(el, areaAspect) / 2;
  const rad = (el.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Rotate in physical space (y scaled by areaAspect), then back
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => {
    const py = dy * areaAspect;
    const rx = dx * cos - py * sin;
    const ry = dx * sin + py * cos;
    return { x: el.x + rx, y: el.y + ry / areaAspect };
  });
}

/** True if any part of the element pokes outside the safe zone. */
export function outsideSafe(el: El, areaAspect: number, inset: number) {
  const insetY = inset / areaAspect;
  return corners(el, areaAspect).some((p) => p.x < inset || p.x > 1 - inset || p.y < insetY || p.y > 1 - insetY);
}

/** Printed resolution of a design at its current size. */
export function effectiveDpi(el: DesignEl, imageWidthPx: number, printWidthIn: number) {
  return imageWidthPx / (el.w * printWidthIn);
}

export type Guide = { axis: "x" | "y"; at: number };

/**
 * Snap an element's centre to the middle of the print or to other elements'
 * centres when it's within `threshold`. Returns the snapped position and the
 * guide lines to draw.
 */
export function snapPosition(
  x: number,
  y: number,
  others: { x: number; y: number }[],
  threshold = 0.012,
): { x: number; y: number; guides: Guide[] } {
  const guides: Guide[] = [];
  const xs = [0.5, ...others.map((o) => o.x)];
  const ys = [0.5, ...others.map((o) => o.y)];
  let sx = x;
  let sy = y;
  let bestX = threshold;
  for (const t of xs) {
    const d = Math.abs(t - x);
    if (d < bestX) {
      bestX = d;
      sx = t;
    }
  }
  let bestY = threshold;
  for (const t of ys) {
    const d = Math.abs(t - y);
    if (d < bestY) {
      bestY = d;
      sy = t;
    }
  }
  if (sx !== x) guides.push({ axis: "x", at: sx });
  if (sy !== y) guides.push({ axis: "y", at: sy });
  return { x: sx, y: sy, guides };
}

/** Keep stored layouts sane (they come back from the database). */
export function sanitizeLayout(raw: unknown): Layout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Layout>;
  const clamp = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  const elements: El[] = [];
  for (const e of Array.isArray(r.elements) ? r.elements.slice(0, 400) : []) {
    if (!e || typeof e !== "object") continue;
    const base = {
      id: String((e as El).id ?? "").slice(0, 80) || `e-${elements.length}`,
      x: clamp((e as El).x, -0.5, 1.5, 0.5),
      y: clamp((e as El).y, -0.5, 1.5, 0.5),
      w: clamp((e as El).w, 0.01, 2, 0.2),
      rot: clamp((e as El).rot, -360, 360, 0),
    };
    if ((e as El).kind === "design" && typeof (e as DesignEl).designId === "string") {
      elements.push({ ...base, kind: "design", designId: (e as DesignEl).designId, aspect: clamp((e as DesignEl).aspect, 0.05, 20, 1) });
    } else if ((e as El).kind === "text") {
      const t = e as TextEl;
      elements.push({
        ...base,
        kind: "text",
        text: String(t.text ?? "").slice(0, 120),
        font: t.font === "serif" ? "serif" : "script",
        color: /^#[0-9a-f]{6}$/i.test(String(t.color)) ? t.color : "#3b4836",
        size: clamp(t.size, 0.005, 0.5, 0.06),
      });
    }
  }
  return {
    version: 1,
    background: /^#[0-9a-f]{6}$/i.test(String(r.background)) ? (r.background as string) : "#ffffff",
    snap: r.snap !== false,
    elements,
  };
}
