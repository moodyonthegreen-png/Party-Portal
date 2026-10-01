"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  effectiveDpi,
  heightFrac,
  outsideSafe,
  scatter,
  snapPosition,
  type DesignEl,
  type El,
  type Guide,
  type Layout,
  type TextEl,
} from "@/lib/gift/layout";
import { inches, type Product } from "@/lib/gift/products";

export type Source = { designId: string; guestName: string; url: string | null; width: number; height: number };

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; elX: number; elY: number }
  | { kind: "resize"; id: string; cx: number; cy: number; startDist: number; startW: number; startSize: number }
  | { kind: "rotate"; id: string; cx: number; cy: number };

const SWATCHES = ["#ffffff", "#fffdf6", "#f5f2e6", "#e4ecdc", "#f7e5a6", "#dfe8f1", "#f6e1e1", "#5d7a53", "#3b4836"];

/** Warnings shown beside the editor, and the ids they apply to. */
export function layoutWarnings(layout: Layout, product: Product, sources: Map<string, Source>) {
  const areaAspect = product.heightPx / product.widthPx;
  const inset = product.safeInsetIn / inches(product).w;
  const minDpi = Math.round(product.dpi * 0.5);
  const out: { id: string; text: string; level: "warn" | "info" }[] = [];
  for (const el of layout.elements) {
    const who = el.kind === "design" ? `${sources.get(el.designId)?.guestName ?? "A guest"}'s design` : `“${el.text}”`;
    if (outsideSafe(el, areaAspect, inset)) out.push({ id: el.id, level: "warn", text: `${who} goes past the safe area and may be trimmed.` });
    if (el.kind === "design") {
      const src = sources.get(el.designId);
      if (src && effectiveDpi(el, src.width, inches(product).w) < minDpi) {
        out.push({ id: el.id, level: "warn", text: `${who} is enlarged a lot and may print a little soft. Try making it smaller.` });
      }
    }
  }
  return out;
}

export function Stage({
  product,
  layout,
  sources,
  mode,
  selectedId,
  warnIds,
  onSelect,
  onChange,
  onCommit,
}: {
  product: Product;
  layout: Layout;
  sources: Map<string, Source>;
  mode: "edit" | "flat" | "mockup";
  selectedId: string | null;
  warnIds: Set<string>;
  onSelect: (id: string | null) => void;
  onChange: (elements: El[]) => void;
  /** Called when a drag ends, to record an undo step and save */
  onCommit: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  const drag = useRef<Drag | null>(null);
  const areaAspect = product.heightPx / product.widthPx;
  const inset = product.safeInsetIn / inches(product).w;
  const editing = mode === "edit";

  // Fit the stage to the space available (and the screen height)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const maxW = el.clientWidth;
      const maxH = Math.max(320, window.innerHeight * 0.72);
      const scale = mode === "mockup" && product.mockup === "bodysuit" ? 0.42 : mode === "mockup" ? 0.86 : 1;
      setW(Math.floor(Math.min(maxW, maxH / areaAspect) * scale));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [areaAspect, mode, product.mockup]);

  const H = W * areaAspect;

  const update = useCallback(
    (id: string, patch: Partial<DesignEl> & Partial<TextEl>) =>
      onChange(layout.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e))),
    [layout.elements, onChange],
  );

  const stagePoint = (e: React.PointerEvent | PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r };
  };

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = stagePoint(e);
    const el = layout.elements.find((x) => x.id === d.id);
    if (!el) return;
    if (d.kind === "move") {
      let nx = d.elX + (p.x - d.startX);
      let ny = d.elY + (p.y - d.startY);
      if (layout.snap) {
        const s = snapPosition(nx, ny, layout.elements.filter((x) => x.id !== d.id));
        nx = s.x;
        ny = s.y;
        setGuides(s.guides);
      }
      update(d.id, { x: nx, y: ny });
    } else if (d.kind === "resize") {
      const dist = Math.hypot((p.x - d.cx) * W, (p.y - d.cy) * H);
      const k = Math.max(0.1, dist / d.startDist);
      const w = Math.min(1.5, Math.max(0.03, d.startW * k));
      update(d.id, el.kind === "text" ? { w, size: d.startSize * (w / d.startW) } : { w });
    } else {
      let deg = (Math.atan2((p.y - d.cy) * H, (p.x - d.cx) * W) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (layout.snap) for (const t of [-180, -90, 0, 90, 180]) if (Math.abs(deg - t) < 4) deg = t;
      update(d.id, { rot: Math.round(deg) });
    }
  }

  function endDrag() {
    if (drag.current) {
      drag.current = null;
      setGuides([]);
      onCommit();
    }
  }

  function startMove(e: React.PointerEvent, el: El) {
    if (!editing) return;
    e.stopPropagation();
    onSelect(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = stagePoint(e);
    drag.current = { kind: "move", id: el.id, startX: p.x, startY: p.y, elX: el.x, elY: el.y };
  }

  function startResize(e: React.PointerEvent, el: El) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = stagePoint(e);
    drag.current = {
      kind: "resize",
      id: el.id,
      cx: el.x,
      cy: el.y,
      startDist: Math.max(4, Math.hypot((p.x - el.x) * W, (p.y - el.y) * H)),
      startW: el.w,
      startSize: el.kind === "text" ? el.size : 0,
    };
  }

  function startRotate(e: React.PointerEvent, el: El) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind: "rotate", id: el.id, cx: el.x, cy: el.y };
  }

  const stage = (
    <div
      ref={stageRef}
      className="gd-stage"
      style={{ width: W, height: H, background: layout.background }}
      onPointerDown={() => editing && onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {layout.elements.map((el) => {
        const selected = editing && el.id === selectedId;
        const h = heightFrac(el, areaAspect) * H;
        const style: React.CSSProperties = {
          left: el.x * W,
          top: el.y * H,
          width: el.w * W,
          height: h,
          transform: `translate(-50%, -50%) rotate(${el.rot}deg)`,
        };
        return (
          <div
            key={el.id}
            className="gd-el"
            data-selected={selected}
            data-warn={editing && warnIds.has(el.id)}
            style={style}
            onPointerDown={(e) => startMove(e, el)}
          >
            {el.kind === "design" ? (
              sources.get(el.designId)?.url ? (
                <img src={sources.get(el.designId)!.url!} alt="" draggable={false} crossOrigin="anonymous" />
              ) : (
                <div className="gd-missing">Design removed</div>
              )
            ) : (
              <div
                className={el.font === "script" ? "pp-script" : "pp-display"}
                style={{
                  fontSize: el.size * W,
                  color: el.color,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: el.font === "serif" ? 600 : 400,
                }}
              >
                {el.text}
              </div>
            )}
            {selected && (
              <>
                <span className="gd-handle gd-rotate" onPointerDown={(e) => startRotate(e, el)} title="Rotate" />
                <span className="gd-handle gd-resize" onPointerDown={(e) => startResize(e, el)} title="Resize" />
              </>
            )}
          </div>
        );
      })}

      {editing && (
        <>
          {/* Print-safe zone */}
          <div
            className="gd-safe"
            style={{ left: inset * W, top: inset * W, width: W - inset * W * 2, height: H - inset * W * 2 }}
            aria-hidden="true"
          />
          {guides.map((g, i) => (
            <div
              key={i}
              className="gd-guide"
              style={g.axis === "x" ? { left: g.at * W, top: 0, bottom: 0, width: 1 } : { top: g.at * H, left: 0, right: 0, height: 1 }}
            />
          ))}
        </>
      )}
    </div>
  );

  return (
    <div ref={wrapRef} style={{ width: "100%", display: "grid", placeItems: "center" }}>
      {mode === "mockup" ? <Mockup product={product} width={W}>{stage}</Mockup> : stage}
    </div>
  );
}

/** Simple product mockups around the flat design. */
function Mockup({ product, width, children }: { product: Product; width: number; children: React.ReactNode }) {
  if (product.mockup === "bodysuit") {
    const bodyW = width / 0.42;
    return (
      <div style={{ position: "relative", width: bodyW, height: bodyW * 1.18 }}>
        <svg viewBox="0 0 200 236" width={bodyW} height={bodyW * 1.18} style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 10px 18px rgb(0 0 0 / .18))" }} aria-hidden="true">
          <path
            d="M62 8 C 72 20 128 20 138 8 L 176 26 L 198 62 L 168 80 L 156 66 L 156 150 C 156 172 140 186 124 196 L 120 232 L 80 232 L 76 196 C 60 186 44 172 44 150 L 44 66 L 32 80 L 2 62 L 24 26 Z"
            fill="#ffffff"
            stroke="#e6e1d4"
            strokeWidth="1.5"
          />
          <path d="M62 8 C 72 26 128 26 138 8" fill="none" stroke="#e6e1d4" strokeWidth="2" />
        </svg>
        <div style={{ position: "absolute", left: "50%", top: "21%", transform: "translateX(-50%)", mixBlendMode: "multiply" }}>{children}</div>
      </div>
    );
  }
  return (
    <div className={`gd-mock gd-mock-${product.mockup}`} style={{ width }}>
      {product.mockup === "towel" && <div className="gd-hood" aria-hidden="true" />}
      {children}
      <div className="gd-fabric" aria-hidden="true" />
    </div>
  );
}

/** Start a fresh layout: everyone's designs scattered over the product. */
export function freshLayout(product: Product, sources: Source[], background: string, seed = 7): Layout {
  const areaAspect = product.heightPx / product.widthPx;
  const inset = product.safeInsetIn / inches(product).w + 0.01;
  return {
    version: 1,
    background,
    snap: true,
    elements: scatter(
      sources.map((s) => ({ designId: s.designId, aspect: s.height / Math.max(1, s.width) })),
      { areaAspect, inset, seed },
    ),
  };
}

export function useSourceMap(sources: Source[]) {
  return useMemo(() => new Map(sources.map((s) => [s.designId, s])), [sources]);
}

export { SWATCHES };
