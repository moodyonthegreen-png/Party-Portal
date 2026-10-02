"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ASPECT,
  framesFor,
  hitSticker,
  renderScene,
  stickerBox,
  stickersFor,
  type Placed,
  type Scene,
  type Sticker,
  type Stroke,
  type Tokens,
} from "@/lib/booth/art";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { finishPhoto, startPhoto } from "./actions";
import { BOOTH_PROMPTS, type BoothPrompt } from "@/lib/booth/prompts";

type Step = "start" | "edit" | "share" | "done";
type Tool = "frames" | "stickers" | "draw";
type Prompt = BoothPrompt;

const PEN_COLORS = ["#ffffff", "#253026", "#56704f", "#e8c25a", "#efb1bd", "#8fb5d9"];
const PEN_SIZES = [
  { label: "Fine", size: 0.008 },
  { label: "Medium", size: 0.016 },
  { label: "Bold", size: 0.03 },
];
const SAVE_W = 1440;
const DISPLAY_W = 1080;

function readTokens(el: HTMLElement): Tokens {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    cover: v("--pp-cover", "#9aae91"),
    coverInk: v("--pp-cover-ink", "#fbfaf3"),
    gold: v("--pp-gold", "#b8923a"),
    accent: v("--pp-accent", "#56704f"),
    ink: v("--pp-ink", "#253026"),
    paper: v("--pp-paper", "#fffefb"),
    serif: v("--pp-serif", "Georgia, serif"),
    sans: v("--pp-sans", "system-ui, sans-serif"),
  };
}

/** Load a photo, downscaled so editing stays smooth on phones. */
async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't save the picture."))), "image/jpeg", quality));
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function PhotoBooth({
  slug,
  theme,
  guestOfHonorName,
  occasion,
  eventDate,
  onQuickUpload,
}: {
  slug: string;
  theme: string;
  guestOfHonorName: string;
  occasion: string;
  eventDate: string | null;
  onQuickUpload: () => void;
}) {
  const router = useRouter();
  const first = guestOfHonorName.split(" ")[0];
  const frames = useMemo(() => framesFor(theme), [theme]);
  const stickers = useMemo(() => stickersFor(theme), [theme]);
  const when = new Date(eventDate ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const line = `${occasion}, ${when}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [tool, setTool] = useState<Tool>("frames");
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<Scene>({ frameId: frames[0].id, photo: { zoom: 1, dx: 0, dy: 0 }, strokes: [], stickers: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [pen, setPen] = useState({ color: PEN_COLORS[0], size: PEN_SIZES[1].size });
  const [prompt, setPrompt] = useState<Prompt>("note");
  const [story, setStory] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rootRef.current) setTokens(readTokens(rootRef.current));
    try {
      setName(localStorage.getItem(`pp_name_${slug}`) ?? "");
    } catch {
      /* storage blocked */
    }
    // Make sure the frame and sticker lettering uses the real fonts
    void document.fonts?.ready.then(() => rootRef.current && setTokens(readTokens(rootRef.current)));
  }, [slug]);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("Opening your photo…");
    try {
      const c = await loadPhoto(file);
      setPhoto(c);
      setScene({ frameId: frames[0].id, photo: { zoom: 1, dx: 0, dy: 0 }, strokes: [], stickers: [] });
      setSelected(null);
      setTool("frames");
      setStep("edit");
    } catch {
      setError("That photo couldn't be opened here. Try a JPEG or PNG, or take a new photo.");
    } finally {
      setBusy(null);
    }
  }

  // ---- drawing the picture ---------------------------------------------------
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (step !== "edit") return;
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSize({ w, h: Math.round(w * ASPECT) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [step]);

  const paint = useCallback(
    (canvas: HTMLCanvasElement, W: number, H: number, sc: Scene) => {
      if (!tokens) return;
      const ctx = canvas.getContext("2d")!;
      renderScene(ctx, W, H, { scene: sc, img: photo, tokens, frames, stickers, first, name: guestOfHonorName, line });
    },
    [tokens, photo, frames, stickers, first, guestOfHonorName, line],
  );

  // Strokes in progress are drawn without touching React state on every move
  const live = useRef<Stroke | null>(null);
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(size.w * dpr)) {
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
    }
    const sc = live.current ? { ...scene, strokes: [...scene.strokes, live.current] } : scene;
    paint(c, c.width, c.height, sc);
  }, [paint, scene, size]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  // ---- pointer handling --------------------------------------------------------
  const gesture = useRef<
    | { kind: "draw" }
    | { kind: "move"; uid: string; ox: number; oy: number }
    | { kind: "pan"; sx: number; sy: number; dx: number; dy: number }
    | { kind: "turn"; uid: string; cx: number; cy: number; a0: number; d0: number; rot0: number; w0: number }
    | null
  >(null);

  const point = (e: React.PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
  };

  const measureCtx = () => canvasRef.current!.getContext("2d")!;

  function onDown(e: React.PointerEvent) {
    if (!tokens) return;
    const p = point(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (tool === "draw") {
      live.current = { color: pen.color, size: pen.size, pts: [p.x, p.y] };
      gesture.current = { kind: "draw" };
      setSelected(null);
      draw();
      return;
    }
    const hit = hitSticker(measureCtx(), size.w, size.h, p.x, p.y, scene.stickers, stickers, tokens, first);
    if (hit) {
      setSelected(hit.uid);
      // bring to front
      setScene((s) => ({ ...s, stickers: [...s.stickers.filter((x) => x.uid !== hit.uid), hit] }));
      gesture.current = { kind: "move", uid: hit.uid, ox: p.x - hit.x, oy: p.y - hit.y };
    } else {
      setSelected(null);
      gesture.current = { kind: "pan", sx: p.x, sy: p.y, dx: scene.photo.dx, dy: scene.photo.dy };
    }
  }

  function onMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    if (g.kind === "draw" && live.current) {
      const pts = live.current.pts;
      const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
      if (Math.hypot((p.x - lx) * size.w, (p.y - ly) * size.h) > 2) {
        pts.push(p.x, p.y);
        draw();
      }
    } else if (g.kind === "move") {
      setScene((s) => ({
        ...s,
        stickers: s.stickers.map((x) => (x.uid === g.uid ? { ...x, x: Math.min(1, Math.max(0, p.x - g.ox)), y: Math.min(1, Math.max(0, p.y - g.oy)) } : x)),
      }));
    } else if (g.kind === "pan") {
      const f = frames.find((x) => x.id === scene.frameId)!;
      const ww = 1 - f.window[0] - f.window[2], wh = 1 - f.window[1] - f.window[3];
      setScene((s) => ({ ...s, photo: { ...s.photo, dx: g.dx + (p.x - g.sx) / ww, dy: g.dy + (p.y - g.sy) / wh } }));
    } else if (g.kind === "turn") {
      const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      const d = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      setScene((s) => ({
        ...s,
        stickers: s.stickers.map((x) =>
          x.uid === g.uid ? { ...x, rot: g.rot0 + ((a - g.a0) * 180) / Math.PI, w: Math.min(1.2, Math.max(0.06, (g.w0 * d) / Math.max(8, g.d0))) } : x,
        ),
      }));
    }
  }

  function onUp() {
    const g = gesture.current;
    gesture.current = null;
    if (g?.kind === "draw" && live.current) {
      const stroke = live.current;
      live.current = null;
      setScene((s) => ({ ...s, strokes: [...s.strokes, stroke] }));
    }
    if (g?.kind === "pan") {
      // keep the stored offset inside what the renderer allows
      setScene((s) => ({ ...s, photo: { ...s.photo, dx: Math.max(-1, Math.min(1, s.photo.dx)), dy: Math.max(-1, Math.min(1, s.photo.dy)) } }));
    }
  }

  function startTurn(e: React.PointerEvent, p: Placed) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = stageRef.current!.getBoundingClientRect();
    const cx = r.left + p.x * r.width, cy = r.top + p.y * r.height;
    gesture.current = { kind: "turn", uid: p.uid, cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), d0: Math.hypot(e.clientX - cx, e.clientY - cy), rot0: p.rot, w0: p.w };
  }

  function addSticker(s: Sticker) {
    const p: Placed = {
      uid: uid(),
      stickerId: s.id,
      x: 0.3 + Math.random() * 0.4,
      y: 0.22 + Math.random() * 0.4,
      w: s.kind === "text" ? 0.52 : 0.22,
      rot: Math.round((Math.random() - 0.5) * 16),
    };
    setScene((sc) => ({ ...sc, stickers: [...sc.stickers, p] }));
    setSelected(p.uid);
  }

  const sel = scene.stickers.find((p) => p.uid === selected) ?? null;
  const selBox = useMemo(() => {
    if (!sel || !tokens || !canvasRef.current || !size.w) return null;
    const def = stickers.find((s) => s.id === sel.stickerId);
    if (!def) return null;
    return stickerBox(canvasRef.current.getContext("2d")!, def, sel.w * size.w, tokens, first);
  }, [sel, tokens, size.w, stickers, first]);

  // ---- saving ---------------------------------------------------------------------
  function toShare() {
    setSelected(null);
    const c = document.createElement("canvas");
    c.width = 540;
    c.height = Math.round(540 * ASPECT);
    paint(c, c.width, c.height, scene);
    setPreview(c.toDataURL("image/jpeg", 0.85));
    setStep("share");
  }

  async function save() {
    if (!name.trim()) {
      setError("Please add your name.");
      return;
    }
    setError(null);
    try {
      localStorage.setItem(`pp_name_${slug}`, name.trim());
    } catch {
      /* ignore */
    }
    setBusy("Adding your photo…");
    try {
      await document.fonts?.ready;
      const full = document.createElement("canvas");
      full.width = SAVE_W;
      full.height = Math.round(SAVE_W * ASPECT);
      paint(full, full.width, full.height, scene);
      const small = document.createElement("canvas");
      small.width = DISPLAY_W;
      small.height = Math.round(DISPLAY_W * ASPECT);
      small.getContext("2d")!.drawImage(full, 0, 0, small.width, small.height);
      const [big, display] = await Promise.all([toBlob(full, 0.92), toBlob(small, 0.88)]);

      const res = await startPhoto(slug, {
        name,
        caption: "",
        originalMime: "image/jpeg",
        originalSize: big.size,
        prompt: story.trim() ? prompt : null,
        story,
      });
      if (!res.ok) throw new Error(res.error);
      const bucket = supabaseBrowser().storage.from("photos");
      const [a, b] = await Promise.all([
        bucket.uploadToSignedUrl(res.display.path, res.display.token, display, { contentType: "image/jpeg" }),
        bucket.uploadToSignedUrl(res.original.path, res.original.token, big, { contentType: "image/jpeg" }),
      ]);
      if (a.error || b.error) throw new Error("Your photo didn't finish uploading. Check your connection and try again.");
      const fin = await finishPhoto(slug, res.id, { width: small.width, height: small.height });
      if (!fin.ok) throw new Error(fin.error);
      setStep("done");
      setStory("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const questions: Record<Prompt, { title: string; ask: string; placeholder: string }> = {
    note: { title: "Just a note", ask: `Anything you'd like to say to ${first}?`, placeholder: "Working on a little something for you…" },
    intro: { title: "Introduce yourself", ask: `How do you know ${first}?`, placeholder: `I'm ${first}'s college roommate! We…` },
    memory: { title: "Share a memory", ask: `What's a favorite memory with ${first}?`, placeholder: "I'll never forget the time…" },
  };

  return (
    <div ref={rootRef} className="pb">
      <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={choose} />
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={choose} />

      {step === "start" && (
        <section className="pp-paper pb-start">
          <h2 className="pb-title">Step into the booth</h2>
          <p className="pp-soft">
            Snap a selfie or pick a favorite photo, dress it up with a frame, stickers and doodles, then say hello to {first}.
          </p>
          <div className="pb-actions">
            <button type="button" className="pp-btn" onClick={() => camRef.current?.click()} disabled={Boolean(busy)}>
              {busy ?? "Take a photo"}
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" onClick={() => pickRef.current?.click()} disabled={Boolean(busy)}>
              Choose a photo
            </button>
          </div>
          <button type="button" className="pp-link" style={{ fontSize: "0.9rem", justifySelf: "start" }} onClick={onQuickUpload}>
            Add several photos without decorating
          </button>
          {error && <p role="alert" className="pb-error">{error}</p>}
        </section>
      )}

      {step === "edit" && (
        <section className="pb-editor">
          <div
            ref={stageRef}
            className="pb-stage"
            data-tool={tool}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <canvas ref={canvasRef} className="pb-canvas" aria-label="Your photo booth picture" role="img" />
            {sel && selBox && tool !== "draw" && (
              <div
                className="pb-select"
                style={{
                  left: sel.x * size.w,
                  top: sel.y * size.h,
                  width: selBox.w + 16,
                  height: selBox.h + 16,
                  transform: `translate(-50%, -50%) rotate(${sel.rot}deg)`,
                }}
              >
                <button
                  type="button"
                  className="pb-x"
                  aria-label="Remove sticker"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setScene((s) => ({ ...s, stickers: s.stickers.filter((x) => x.uid !== sel.uid) }));
                    setSelected(null);
                  }}
                >
                  ×
                </button>
                <span className="pb-turn" aria-label="Drag to resize and turn" onPointerDown={(e) => startTurn(e, sel)} />
              </div>
            )}
          </div>

          <div className="pb-tools">
            <div className="pb-tabs" role="tablist" aria-label="Decorate">
              {(["frames", "stickers", "draw"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tool === t} onClick={() => setTool(t)}>
                  {t === "frames" ? "Frame" : t === "stickers" ? "Stickers" : "Draw"}
                </button>
              ))}
            </div>

            {tool === "frames" && (
              <div className="pb-panel">
                <div className="pb-frames">
                  {frames.map((f) => (
                    <FrameThumb key={f.id} active={scene.frameId === f.id} label={f.label} onPick={() => setScene((s) => ({ ...s, frameId: f.id }))}>
                      {(c) => paint(c, c.width, c.height, { ...scene, frameId: f.id, strokes: [], stickers: [] })}
                    </FrameThumb>
                  ))}
                </div>
                <label className="pb-zoom">
                  <span>Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={2.5}
                    step={0.01}
                    value={scene.photo.zoom}
                    onChange={(e) => setScene((s) => ({ ...s, photo: { ...s.photo, zoom: Number(e.target.value) } }))}
                  />
                </label>
                <p className="pb-hint">Drag the photo to move it.</p>
              </div>
            )}

            {tool === "stickers" && (
              <div className="pb-panel">
                <div className="pb-stickers">
                  {stickers.map((s) => (
                    <StickerButton key={s.id} sticker={s} tokens={tokens} first={first} onPick={() => addSticker(s)} />
                  ))}
                </div>
                <p className="pb-hint">Drag a sticker to move it. Use its corner dot to resize and turn it.</p>
              </div>
            )}

            {tool === "draw" && (
              <div className="pb-panel">
                <div className="pb-pens">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="pb-pen"
                      aria-label={`Pen color ${c}`}
                      aria-pressed={pen.color === c}
                      style={{ background: c }}
                      onClick={() => setPen((p) => ({ ...p, color: c }))}
                    />
                  ))}
                </div>
                <div className="pb-sizes">
                  {PEN_SIZES.map((s) => (
                    <button key={s.label} type="button" className="pb-size" aria-pressed={pen.size === s.size} onClick={() => setPen((p) => ({ ...p, size: s.size }))}>
                      <span style={{ width: 6 + s.size * 260, height: 6 + s.size * 260, background: pen.color === "#ffffff" ? "#cfd6c8" : pen.color }} />
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="pb-row">
                  <button type="button" className="pp-link" disabled={!scene.strokes.length} onClick={() => setScene((s) => ({ ...s, strokes: s.strokes.slice(0, -1) }))}>
                    Undo
                  </button>
                  <button
                    type="button"
                    className="pp-link"
                    disabled={!scene.strokes.length}
                    onClick={() => window.confirm("Clear all your drawing?") && setScene((s) => ({ ...s, strokes: [] }))}
                  >
                    Clear drawing
                  </button>
                </div>
                <p className="pb-hint">Draw right on the photo.</p>
              </div>
            )}

            <div className="pb-actions">
              <button type="button" className="pp-btn" onClick={toShare}>
                Next
              </button>
              <button type="button" className="pp-btn pp-btn-ghost" onClick={() => pickRef.current?.click()}>
                Use a different photo
              </button>
            </div>
          </div>
        </section>
      )}

      {step === "share" && (
        <section className="pp-paper pb-share">
          {preview && <img src={preview} alt="Your photo booth picture" className="pb-preview" />}
          <div className="pb-share-form">
            <h2 className="pb-title">Say hello</h2>
            <div className="pb-prompts" role="radiogroup" aria-label="What would you like to share?">
              {BOOTH_PROMPTS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={prompt === k} className="pb-prompt" onClick={() => setPrompt(k)}>
                  <strong>{questions[k].title}</strong>
                  <span>{questions[k].ask}</span>
                </button>
              ))}
            </div>
            <label htmlFor="pb-story" className="pp-caps">
              {questions[prompt].ask}
            </label>
            <textarea
              id="pb-story"
              className="pp-field"
              rows={4}
              maxLength={600}
              value={story}
              placeholder={questions[prompt].placeholder}
              onChange={(e) => setStory(e.target.value)}
            />
            <p className="pb-hint" style={{ marginTop: "-0.4rem" }}>
              Optional, but {first} would love to hear it. {story.length > 450 ? `${600 - story.length} characters left.` : ""}
            </p>
            <label htmlFor="pb-name" className="pp-caps">
              Your name
            </label>
            <input id="pb-name" className="pp-field" value={name} maxLength={80} autoComplete="name" placeholder="e.g. Aunt Mimi" onChange={(e) => setName(e.target.value)} />
            <div className="pb-actions">
              <button type="button" className="pp-btn" onClick={save} disabled={Boolean(busy)}>
                {busy ?? "Add to the album"}
              </button>
              <button type="button" className="pp-btn pp-btn-ghost" onClick={() => setStep("edit")} disabled={Boolean(busy)}>
                Back to decorating
              </button>
            </div>
            {error && <p role="alert" className="pb-error">{error}</p>}
          </div>
        </section>
      )}

      {step === "done" && (
        <section className="pp-paper pb-start" style={{ textAlign: "center", justifyItems: "center" }}>
          <h2 className="pb-title">You&apos;re in the album!</h2>
          <p className="pp-soft">Thank you for celebrating {first}. Scroll down to see your photo with everyone else&apos;s.</p>
          <div className="pb-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="pp-btn" onClick={() => camRef.current?.click()}>
              Take another
            </button>
            <button type="button" className="pp-btn pp-btn-ghost" onClick={() => pickRef.current?.click()}>
              Choose another photo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function FrameThumb({ active, label, onPick, children }: { active: boolean; label: string; onPick: () => void; children: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) children(ref.current);
  });
  return (
    <button type="button" className="pb-frame" aria-pressed={active} onClick={onPick}>
      <canvas ref={ref} width={120} height={150} />
      <span>{label}</span>
    </button>
  );
}

function StickerButton({ sticker, tokens, first, onPick }: { sticker: Sticker; tokens: Tokens | null; first: string; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !tokens) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    const w = sticker.kind === "text" ? 0.92 : 0.62;
    const box = stickerBox(ctx, sticker, w * c.width, tokens, first);
    const fit = Math.min(1, (c.height * 0.8) / box.h);
    renderScene(ctx, c.width, c.height, {
      scene: { frameId: "none", photo: { zoom: 1, dx: 0, dy: 0 }, strokes: [], stickers: [{ uid: "p", stickerId: sticker.id, x: 0.5, y: 0.5, w: w * fit, rot: 0 }] },
      img: null,
      tokens,
      frames: [{ id: "none", label: "", window: [0, 0, 0, 0], draw() {} }],
      stickers: [sticker],
      first,
      name: "",
      line: "",
      backdrop: null,
    });
  }, [sticker, tokens, first]);
  return (
    <button type="button" className="pb-sticker" onClick={onPick} aria-label={`Add ${sticker.label} sticker`} title={sticker.label}>
      <canvas ref={ref} width={160} height={110} />
    </button>
  );
}
