/**
 * Photo booth artwork: original vector stickers, text stickers and theme
 * frames. Everything is drawn with the canvas API so the screen preview and
 * the saved photo are identical. Safe to import in the browser.
 */

export type Tokens = {
  cover: string;
  coverInk: string;
  gold: string;
  accent: string;
  ink: string;
  paper: string;
  serif: string; // CSS font-family list
  sans: string;
};

type Part = { d: string; fill?: string; stroke?: string; sw?: number };
export type VecSticker = { id: string; label: string; kind: "vec"; vb: [number, number]; parts: Part[] };
export type TextSticker = {
  id: string;
  label: string;
  kind: "text";
  text: string; // "{first}" is replaced with the guest of honor's first name
  style: "script" | "badge" | "bubble";
};
export type Sticker = VecSticker | TextSticker;

// ---------------------------------------------------------------------------
// Stickers
// ---------------------------------------------------------------------------

const INK = "#3a4639";
const star = (cx: number, cy: number, r: number, inner = 0.45) => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
};
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const BABY: Sticker[] = [
  { id: "heart", label: "Heart", kind: "vec", vb: [24, 22], parts: [{ d: "M12 21s-7.6-4.6-9.7-9.4C.9 8.3 3 4.4 6.9 4.4c2.1 0 3.7 1.1 4.6 2.7h1c.9-1.6 2.5-2.7 4.6-2.7 3.9 0 6 3.9 4.6 7.2C19.6 16.4 12 21 12 21z", fill: "#efb1bd", stroke: "#fff", sw: 1.4 }] },
  { id: "star", label: "Star", kind: "vec", vb: [24, 24], parts: [{ d: star(12, 12.6, 11), fill: "#e8c25a", stroke: "#fff", sw: 1.2 }] },
  { id: "sparkle", label: "Sparkle", kind: "vec", vb: [24, 24], parts: [{ d: "M12 1c.9 5.6 3.4 8.1 9 9-5.6.9-8.1 3.4-9 9-.9-5.6-3.4-8.1-9-9 5.6-.9 8.1-3.4 9-9z", fill: "#e2c67a" }, { d: "M20 16c.4 2.3 1.4 3.3 3.6 3.6-2.2.4-3.2 1.4-3.6 3.6-.4-2.2-1.4-3.2-3.6-3.6 2.2-.3 3.2-1.3 3.6-3.6z", fill: "#e2c67a" }] },
  { id: "moon", label: "Moon", kind: "vec", vb: [24, 24], parts: [{ d: "M20.5 14.6A9 9 0 1 1 9.4 3.5a7.2 7.2 0 0 0 11.1 11.1z", fill: "#f3e3a2", stroke: "#d8b960", sw: 1 }, { d: star(17.5, 6, 2.6), fill: "#e8c25a" }] },
  { id: "cloud", label: "Cloud", kind: "vec", vb: [26, 18], parts: [{ d: "M7 16.5h12.5a5 5 0 0 0 .7-9.95A6.5 6.5 0 0 0 7.6 5.3 5.6 5.6 0 0 0 7 16.5z", fill: "#ffffff", stroke: "#b9c9dc", sw: 1.3 }] },
  {
    id: "rattle",
    label: "Rattle",
    kind: "vec",
    vb: [24, 30],
    parts: [
      { d: "M11 14h2v9h-2z", fill: "#c9d6bf" },
      { d: circle(12, 26, 3), fill: "none", stroke: "#9aae91", sw: 1.8 },
      { d: circle(12, 8, 7.2), fill: "#f3e3a2", stroke: "#d8b960", sw: 1.2 },
      { d: circle(9.5, 6.5, 1.2) + circle(14.5, 9.5, 1.2) + circle(13, 4.8, 0.9), fill: "#e8b5c0" },
    ],
  },
  {
    id: "bottle",
    label: "Bottle",
    kind: "vec",
    vb: [20, 32],
    parts: [
      { d: "M8 1.5h4l1 4H7z", fill: "#f3d9a0" },
      { d: "M5.5 5.5h9v3h-9z", fill: "#9aae91" },
      { d: "M6.5 8.5h7a2.5 2.5 0 0 1 2.5 2.5v16a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 4 27V11a2.5 2.5 0 0 1 2.5-2.5z", fill: "#ffffff", stroke: "#b9c4b2", sw: 1.2 },
      { d: "M4.8 19h10.4v8a3 3 0 0 1-3 3H7.8a3 3 0 0 1-3-3z", fill: "#e9f0f7" },
      { d: "M11.5 13h2.5M11.5 16.5h2.5M11.5 20h2.5", stroke: "#b9c4b2", sw: 1 },
    ],
  },
  {
    id: "pacifier",
    label: "Pacifier",
    kind: "vec",
    vb: [26, 26],
    parts: [
      { d: circle(13, 6, 4.3), fill: "none", stroke: "#e8b5c0", sw: 2.2 },
      { d: "M3 13.5c0-3 4.5-4.8 10-4.8s10 1.8 10 4.8-4.5 4.8-10 4.8S3 16.5 3 13.5z", fill: "#bcd5ea", stroke: "#fff", sw: 1 },
      { d: circle(13, 13.5, 2.2), fill: "#ffffff" },
      { d: "M10.5 18h5l-.6 4.2a1.9 1.9 0 0 1-3.8 0z", fill: "#f3e3a2" },
    ],
  },
  {
    id: "duck",
    label: "Duck",
    kind: "vec",
    vb: [26, 22],
    parts: [
      { d: "M2.5 13.8c0-2.1 1.6-3.6 3.7-3.6h5.2c-.7-.8-1.1-1.9-1.1-3a4.6 4.6 0 1 1 9.2 0c0 .6-.1 1.2-.3 1.8 1.9.8 3.2 2.6 3.2 4.8 0 4-3.9 6.7-9.9 6.7S2.5 17.7 2.5 13.8z", fill: "#f6d860", stroke: "#fff", sw: 1 },
      { d: "M19.9 6.4l4 1.1-4 1.6z", fill: "#f0a35a" },
      { d: circle(16.6, 5.8, 0.9), fill: INK },
      { d: "M7.5 13.5c2 2.2 5.2 2.6 7.5 1", stroke: "#e2bb3c", sw: 1.2 },
    ],
  },
  {
    id: "onesie",
    label: "Little outfit",
    kind: "vec",
    vb: [26, 26],
    parts: [
      { d: "M8 2c1.2 1.6 8.8 1.6 10 0l4.8 2.6 2.4 4.6-3.6 2-1.5-1.8v8.2c0 2.2-1.7 3.4-3.4 4.4l-.4 2.5h-6.6l-.4-2.5c-1.7-1-3.4-2.2-3.4-4.4V9.4l-1.5 1.8-3.6-2 2.4-4.6z", fill: "#e4ecdc", stroke: "#9aae91", sw: 1.1 },
      { d: "M11.3 12.2c.6-1 2-1 2.6 0 .6-1 2-1 2.6 0 .5 1.3-2.6 3.2-2.6 3.2s-3.1-1.9-2.6-3.2z", fill: "#efb1bd" },
    ],
  },
  { id: "t-oh-baby", label: "Oh baby!", kind: "text", text: "Oh baby!", style: "script" },
  { id: "t-hi", label: "Hi!", kind: "text", text: "Hi, {first}!", style: "bubble" },
  { id: "t-love", label: "Love you already", kind: "text", text: "Love you already", style: "badge" },
  { id: "t-welcome", label: "Welcome, little one", kind: "text", text: "Welcome, little one", style: "badge" },
  { id: "t-cheers", label: "Cheers!", kind: "text", text: "Cheers to you!", style: "script" },
];

const EXPLORER: Sticker[] = [
  { id: "plane", label: "Plane", kind: "vec", vb: [34, 34], parts: [{ d: "M17 2l3 10.5 12 6v3l-12-3-1 8 4 3v2.5l-6-1.6-6 1.6V30l4-3-1-8-12 3v-3l12-6z", fill: "#ffffff", stroke: "#34406b", sw: 1.3 }] },
  {
    id: "balloon",
    label: "Hot air balloon",
    kind: "vec",
    vb: [24, 32],
    parts: [
      { d: "M12 1.5a9 9 0 0 1 9 9c0 5-5 9.2-6.8 11.5H9.8C8 19.7 3 15.5 3 10.5a9 9 0 0 1 9-9z", fill: "#efb1bd", stroke: "#fff", sw: 1 },
      { d: "M12 1.5c-2.6 2.6-3.6 6.2-3.6 9s1.1 7.3 1.4 11.5M12 1.5c2.6 2.6 3.6 6.2 3.6 9s-1.1 7.3-1.4 11.5", fill: "none", stroke: "#fff", sw: 1 },
      { d: "M9.8 22l.8 4M14.2 22l-.8 4", stroke: "#8a6a4a", sw: 0.9 },
      { d: "M9.8 26h4.4v4.2H9.8z", fill: "#c9a46a" },
    ],
  },
  { id: "compass", label: "Compass", kind: "vec", vb: [24, 24], parts: [{ d: circle(12, 12, 10.5), fill: "#fffefb", stroke: "#b8923a", sw: 1.4 }, { d: "M12 4l2.4 8L12 20l-2.4-8z", fill: "#34406b" }, { d: "M12 4l2.4 8h-4.8z", fill: "#c4553a" }] },
  { id: "star", label: "Star", kind: "vec", vb: [24, 24], parts: [{ d: star(12, 12.6, 11), fill: "#e8c25a", stroke: "#fff", sw: 1.2 }] },
  { id: "heart", label: "Heart", kind: "vec", vb: [24, 22], parts: [{ d: "M12 21s-7.6-4.6-9.7-9.4C.9 8.3 3 4.4 6.9 4.4c2.1 0 3.7 1.1 4.6 2.7h1c.9-1.6 2.5-2.7 4.6-2.7 3.9 0 6 3.9 4.6 7.2C19.6 16.4 12 21 12 21z", fill: "#efb1bd", stroke: "#fff", sw: 1.4 }] },
  { id: "cloud", label: "Cloud", kind: "vec", vb: [26, 18], parts: [{ d: "M7 16.5h12.5a5 5 0 0 0 .7-9.95A6.5 6.5 0 0 0 7.6 5.3 5.6 5.6 0 0 0 7 16.5z", fill: "#ffffff", stroke: "#b9c9dc", sw: 1.3 }] },
  { id: "t-adventure", label: "Adventure awaits", kind: "text", text: "Adventure awaits", style: "badge" },
  { id: "t-hi", label: "Hi!", kind: "text", text: "Hi, {first}!", style: "bubble" },
  { id: "t-bon", label: "Bon voyage", kind: "text", text: "Bon voyage, baby!", style: "script" },
  { id: "t-welcome", label: "Welcome, little one", kind: "text", text: "Welcome, little one", style: "badge" },
];

export function stickersFor(theme: string): Sticker[] {
  return theme === "explorer" ? EXPLORER : BABY;
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export type Frame = {
  id: string;
  label: string;
  /** Where the photo shows, as shares of the canvas [left, top, right, bottom] */
  window: [number, number, number, number];
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number, t: Tokens, words: { name: string; line: string }) => void;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Fill everything except the photo window. */
function border(ctx: CanvasRenderingContext2D, W: number, H: number, win: Frame["window"], fill: string | CanvasPattern) {
  const [l, t, r, b] = win;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(l * W, t * H, (1 - l - r) * W, (1 - t - b) * H);
  ctx.fillStyle = fill;
  ctx.fill("evenodd");
  ctx.restore();
}

function weave(ctx: CanvasRenderingContext2D, W: number, H: number, win: Frame["window"]) {
  const [l, t, r, b] = win;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(l * W, t * H, (1 - l - r) * W, (1 - t - b) * H);
  ctx.clip("evenodd");
  const step = Math.max(2, W / 360);
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#000";
  for (let x = 0; x < W; x += step * 2) ctx.fillRect(x, 0, step * 0.6, H);
  ctx.fillStyle = "#fff";
  for (let y = 0; y < H; y += step * 2) ctx.fillRect(0, y, W, step * 0.6);
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, px: number) {
  ctx.font = font(px);
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = font(Math.floor((px * maxW) / w));
}

function foil(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "#8a6a22");
  g.addColorStop(0.28, "#d9bb6c");
  g.addColorStop(0.42, "#f4e3a6");
  g.addColorStop(0.58, "#b8923a");
  g.addColorStop(0.78, "#e2c67a");
  g.addColorStop(1, "#9c7a2b");
  return g;
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
}

const KEEPSAKE: Frame = {
  id: "keepsake",
  label: "Keepsake",
  window: [0.07, 0.06, 0.07, 0.19],
  draw(ctx, W, H, t, words) {
    border(ctx, W, H, this.window, t.cover);
    weave(ctx, W, H, this.window);
    const [l, top, r, b] = this.window;
    // gold hairline around the photo
    ctx.strokeStyle = "#e2c67a";
    ctx.lineWidth = Math.max(1.5, W / 420);
    ctx.strokeRect(l * W - W * 0.012, top * H - W * 0.012, (1 - l - r) * W + W * 0.024, (1 - top - b) * H + W * 0.024);
    // name in foil
    const cy = H * (1 - b / 2) - H * 0.012;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, words.name, (px) => `${px}px ${t.serif}`, W * 0.8, Math.round(H * 0.075));
    ctx.fillStyle = foil(ctx, W * 0.2, W * 0.8);
    ctx.fillText(words.name, W / 2, cy);
    ctx.font = `italic ${Math.round(H * 0.026)}px ${t.serif}`;
    ctx.fillStyle = t.coverInk;
    ctx.globalAlpha = 0.9;
    ctx.fillText(words.line, W / 2, cy + H * 0.055);
    ctx.globalAlpha = 1;
  },
};

const POLAROID: Frame = {
  id: "polaroid",
  label: "Instant photo",
  window: [0.06, 0.05, 0.06, 0.2],
  draw(ctx, W, H, t, words) {
    border(ctx, W, H, this.window, "#fffefb");
    const b = this.window[3];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = t.ink;
    fitText(ctx, words.line, (px) => `italic ${px}px ${t.serif}`, W * 0.84, Math.round(H * 0.05));
    ctx.fillText(words.line, W / 2, H * (1 - b / 2));
  },
};

const SPRINKLE: Frame = {
  id: "sprinkle",
  label: "Sprinkle",
  window: [0, 0, 0, 0],
  draw(ctx, W, H, t, words) {
    // soft vignette band at the bottom so the words read on any photo
    const g = ctx.createLinearGradient(0, H * 0.72, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(20,25,20,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    // sparkles along the edges
    const spots: [number, number, number][] = [
      [0.07, 0.07, 0.03], [0.17, 0.04, 0.016], [0.9, 0.06, 0.026], [0.95, 0.17, 0.014], [0.05, 0.22, 0.014],
      [0.93, 0.42, 0.018], [0.04, 0.5, 0.02], [0.08, 0.7, 0.014], [0.94, 0.66, 0.024], [0.84, 0.8, 0.014],
    ];
    ctx.fillStyle = "#f4e3a6";
    for (const [x, y, r] of spots) sparkle(ctx, x * W, y * H, r * W);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, words.name, (px) => `${px}px ${t.serif}`, W * 0.84, Math.round(H * 0.07));
    ctx.fillStyle = foil(ctx, W * 0.2, W * 0.8);
    ctx.fillText(words.name, W / 2, H * 0.88);
    ctx.font = `italic ${Math.round(H * 0.026)}px ${t.serif}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(words.line, W / 2, H * 0.94);
  },
};

const AIRMAIL: Frame = {
  id: "airmail",
  label: "Air mail",
  window: [0.07, 0.06, 0.07, 0.17],
  draw(ctx, W, H, t, words) {
    border(ctx, W, H, this.window, "#fffefb");
    // striped edge
    const s = W * 0.035;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(s, s, W - 2 * s, H - 2 * s);
    ctx.clip("evenodd");
    for (let i = -H, n = 0; i < W + H; i += s * 1.5, n++) {
      ctx.fillStyle = n % 2 ? "#c4553a" : t.cover;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s * 0.75, 0);
      ctx.lineTo(i + s * 0.75 + H, H);
      ctx.lineTo(i + H, H);
      ctx.fill();
    }
    ctx.restore();
    const b = this.window[3];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = t.cover;
    fitText(ctx, words.name, (px) => `${px}px ${t.serif}`, W * 0.7, Math.round(H * 0.055));
    ctx.fillText(words.name, W / 2, H * (1 - b / 2) - H * 0.006);
  },
};

const NONE: Frame = { id: "none", label: "No frame", window: [0, 0, 0, 0], draw() {} };

export function framesFor(theme: string): Frame[] {
  return theme === "explorer" ? [KEEPSAKE, AIRMAIL, POLAROID, NONE] : [KEEPSAKE, POLAROID, SPRINKLE, NONE];
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export type Placed = { uid: string; stickerId: string; x: number; y: number; w: number; rot: number };
export type Stroke = { color: string; size: number; pts: number[] }; // pts: x0,y0,x1,y1,... as shares of W/H
export type Scene = {
  frameId: string;
  photo: { zoom: number; dx: number; dy: number }; // dx/dy as shares of the window
  strokes: Stroke[];
  stickers: Placed[];
};

export const ASPECT = 5 / 4; // height / width (portrait 4:5)

/** Size of a sticker on a canvas W wide (height follows its shape). */
export function stickerBox(ctx: CanvasRenderingContext2D, s: Sticker, w: number, t: Tokens, first: string): { w: number; h: number } {
  if (s.kind === "vec") return { w, h: (w * s.vb[1]) / s.vb[0] };
  const lay = textLayout(ctx, s, w, t, first);
  return { w, h: lay.h };
}

function textLayout(ctx: CanvasRenderingContext2D, s: TextSticker, w: number, t: Tokens, first: string) {
  const text = s.text.replace("{first}", first);
  const font = (px: number) => (s.style === "script" ? `italic ${px}px ${t.serif}` : s.style === "badge" ? `${px}px ${t.serif}` : `600 ${px}px ${t.sans}`);
  const padX = s.style === "script" ? 0 : 0.14;
  ctx.font = font(100);
  const tw = ctx.measureText(text).width;
  const px = (w * (1 - padX * 2)) / (tw / 100);
  const h = s.style === "script" ? px * 1.25 : px * (s.style === "bubble" ? 2.2 : 1.9);
  return { text, font: font(px), px, h };
}

function drawSticker(ctx: CanvasRenderingContext2D, s: Sticker, p: Placed, W: number, H: number, t: Tokens, first: string) {
  const w = p.w * W;
  const { h } = stickerBox(ctx, s, w, t, first);
  ctx.save();
  ctx.translate(p.x * W, p.y * H);
  ctx.rotate((p.rot * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = w * 0.04;
  ctx.shadowOffsetY = w * 0.015;
  if (s.kind === "vec") {
    const k = w / s.vb[0];
    ctx.translate(-w / 2, -h / 2);
    ctx.scale(k, k);
    for (const part of s.parts) {
      const path = new Path2D(part.d);
      if (part.fill && part.fill !== "none") {
        ctx.fillStyle = part.fill;
        ctx.fill(path);
      }
      if (part.stroke) {
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = part.stroke;
        ctx.lineWidth = part.sw ?? 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke(path);
      }
    }
  } else {
    const lay = textLayout(ctx, s, w, t, first);
    if (s.style !== "script") {
      ctx.fillStyle = s.style === "badge" ? t.paper : "#ffffff";
      const bh = s.style === "bubble" ? h * 0.78 : h;
      roundRect(ctx, -w / 2, -h / 2, w, bh, bh / 2);
      ctx.fill();
      if (s.style === "bubble") {
        ctx.beginPath();
        ctx.moveTo(-w * 0.22, -h / 2 + bh - 1);
        ctx.lineTo(-w * 0.3, h / 2);
        ctx.lineTo(-w * 0.08, -h / 2 + bh - 1);
        ctx.fill();
      }
      ctx.shadowColor = "transparent";
      if (s.style === "badge") {
        ctx.strokeStyle = t.gold;
        ctx.lineWidth = Math.max(1, w * 0.008);
        roundRect(ctx, -w / 2 + w * 0.025, -h / 2 + w * 0.025, w - w * 0.05, h - w * 0.05, (h - w * 0.05) / 2);
        ctx.stroke();
      }
    }
    ctx.font = lay.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (s.style === "script") {
      ctx.lineWidth = lay.px * 0.16;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.strokeText(lay.text, 0, 0);
      ctx.shadowColor = "transparent";
      ctx.fillStyle = t.accent;
    } else {
      ctx.fillStyle = s.style === "badge" ? t.ink : t.accent;
    }
    const yOff = s.style === "bubble" ? -h / 2 + (h * 0.78) / 2 : 0;
    ctx.fillText(lay.text, 0, yOff + lay.px * 0.04);
  }
  ctx.restore();
}

/** Paint the whole photo booth picture. Used for the screen and for the saved file. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  opts: { scene: Scene; img: HTMLImageElement | ImageBitmap | HTMLCanvasElement | null; tokens: Tokens; frames: Frame[]; stickers: Sticker[]; first: string; name: string; line: string; backdrop?: string | null },
) {
  const { scene, img, tokens: t } = opts;
  const frame = opts.frames.find((f) => f.id === scene.frameId) ?? opts.frames[opts.frames.length - 1];
  const [l, top, r, b] = frame.window;
  const wx = l * W, wy = top * H, ww = (1 - l - r) * W, wh = (1 - top - b) * H;

  ctx.clearRect(0, 0, W, H);
  if (opts.backdrop !== null) {
    ctx.fillStyle = opts.backdrop ?? "#e9ece4";
    ctx.fillRect(0, 0, W, H);
  }

  // Photo, cover-fit into the window, then the guest's zoom and position
  if (img) {
    const iw = "naturalWidth" in img ? img.naturalWidth : img.width;
    const ih = "naturalHeight" in img ? img.naturalHeight : img.height;
    const cover = Math.max(ww / iw, wh / ih) * scene.photo.zoom;
    const dw = iw * cover, dh = ih * cover;
    const maxX = Math.max(0, (dw - ww) / 2), maxY = Math.max(0, (dh - wh) / 2);
    const ox = Math.max(-maxX, Math.min(maxX, scene.photo.dx * ww));
    const oy = Math.max(-maxY, Math.min(maxY, scene.photo.dy * wh));
    ctx.save();
    ctx.beginPath();
    ctx.rect(wx, wy, ww, wh);
    ctx.clip();
    ctx.drawImage(img, wx + (ww - dw) / 2 + ox, wy + (wh - dh) / 2 + oy, dw, dh);
    ctx.restore();
  }

  frame.draw.call(frame, ctx, W, H, t, { name: opts.name, line: opts.line });

  // Drawing
  for (const s of scene.strokes) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size * W;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const p = s.pts;
    if (p.length === 2) {
      ctx.arc(p[0] * W, p[1] * H, (s.size * W) / 2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    } else {
      ctx.moveTo(p[0] * W, p[1] * H);
      for (let i = 2; i < p.length - 2; i += 2) {
        const mx = ((p[i] + p[i + 2]) / 2) * W, my = ((p[i + 1] + p[i + 3]) / 2) * H;
        ctx.quadraticCurveTo(p[i] * W, p[i + 1] * H, mx, my);
      }
      ctx.lineTo(p[p.length - 2] * W, p[p.length - 1] * H);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stickers on top
  const byId = new Map(opts.stickers.map((s) => [s.id, s]));
  for (const p of scene.stickers) {
    const s = byId.get(p.stickerId);
    if (s) drawSticker(ctx, s, p, W, H, t, opts.first);
  }
}

/** Topmost sticker under a point (shares of W/H), or null. */
export function hitSticker(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  x: number,
  y: number,
  placed: Placed[],
  stickers: Sticker[],
  t: Tokens,
  first: string,
): Placed | null {
  const byId = new Map(stickers.map((s) => [s.id, s]));
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i];
    const s = byId.get(p.stickerId);
    if (!s) continue;
    const { w, h } = stickerBox(ctx, s, p.w * W, t, first);
    const a = (-p.rot * Math.PI) / 180;
    const dx = (x - p.x) * W, dy = (y - p.y) * H;
    const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    const pad = Math.max(10, w * 0.08);
    if (Math.abs(rx) <= w / 2 + pad && Math.abs(ry) <= h / 2 + pad) return p;
  }
  return null;
}
