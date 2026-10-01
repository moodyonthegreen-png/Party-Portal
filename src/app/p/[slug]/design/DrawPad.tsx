"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#23302a", "#c0392b", "#e67e22", "#f1c40f", "#27ae60", "#2e86de", "#8e44ad", "#e88aa5", "#8b5a2b"];
const SIZES = [6, 14, 28];

type Stroke = { color: string; size: number; points: { x: number; y: number }[] };

/**
 * Finger/mouse drawing pad for the digital package. Draws on a transparent
 * square canvas so the result drops straight onto the group gift.
 */
export function DrawPad({ onDone, onCancel }: { onDone: (canvas: HTMLCanvasElement) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const RES = 1400; // internal resolution

  const redraw = (list: Stroke[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, RES, RES);
    for (const s of list) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.points.length === 1) {
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      // Smooth through midpoints
      for (let i = 1; i < s.points.length - 1; i++) {
        const mx = (s.points[i].x + s.points[i + 1].x) / 2;
        const my = (s.points[i].y + s.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(s.points[i].x, s.points[i].y, mx, my);
      }
      const last = s.points[s.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    }
  };

  useEffect(() => redraw(strokes), [strokes]);

  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * RES, y: ((e.clientY - rect.top) / rect.height) * RES };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    // Brush sizes are in screen pixels; scale to the canvas
    const scale = RES / e.currentTarget.getBoundingClientRect().width;
    current.current = { color, size: size * scale, points: [toCanvas(e)] };
    redraw([...strokes, current.current]);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const rect = e.currentTarget.getBoundingClientRect();
    for (const ev of events) {
      current.current.points.push({ x: ((ev.clientX - rect.left) / rect.width) * RES, y: ((ev.clientY - rect.top) / rect.height) * RES });
    }
    redraw([...strokes, current.current]);
  };
  const up = () => {
    if (!current.current) return;
    const s = current.current;
    current.current = null;
    setStrokes((prev) => [...prev, s]);
  };

  return (
    <div className="mt-6">
      <div className="blanket-texture overflow-hidden rounded-2xl border border-line">
        <canvas
          ref={canvasRef}
          width={RES}
          height={RES}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="block aspect-square w-full touch-none"
          aria-label="Drawing area"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Colour">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            className={`size-9 rounded-full border-2 ${color === c ? "border-ink ring-2 ring-ink/20" : "border-white"}`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {SIZES.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            aria-pressed={size === s}
            className={`flex h-10 w-12 items-center justify-center rounded-lg border ${size === s ? "border-moss bg-blush-soft" : "border-line bg-card"}`}
            aria-label={["Thin", "Medium", "Thick"][i] + " brush"}
          >
            <span className="rounded-full bg-ink" style={{ width: s / 1.5 + 2, height: s / 1.5 + 2 }} />
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setStrokes((p) => p.slice(0, -1))} disabled={!strokes.length} className="rounded-lg border border-line bg-card px-3 py-2 text-sm disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={() => setStrokes([])} disabled={!strokes.length} className="rounded-lg border border-line bg-card px-3 py-2 text-sm disabled:opacity-40">
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line bg-card px-4 py-3 font-medium">
          Back
        </button>
        <button
          type="button"
          disabled={!strokes.length}
          onClick={() => canvasRef.current && onDone(canvasRef.current)}
          className="flex-1 rounded-xl bg-moss px-4 py-3 font-medium text-white hover:bg-moss-dark disabled:opacity-50"
        >
          Use this drawing
        </button>
      </div>
    </div>
  );
}
