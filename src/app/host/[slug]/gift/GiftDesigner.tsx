"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { El, Layout, TextEl } from "@/lib/gift/layout";
import { PRODUCTS, inches, type ProductKey } from "@/lib/gift/products";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { finishGiftPrint, makeGiftMockups, makePreviewMockups, saveGiftLayout, startGiftPrint, startPreviewUpload } from "../actions";
import { renderPrint } from "./render";
import { freshLayout, layoutWarnings, Stage, SWATCHES, useSourceMap, type Source } from "./Stage";

type Mockup = { src: string; position: string; isDefault: boolean };
type Saved = {
  productKey: ProductKey;
  layout: Layout;
  status: "draft" | "final";
  printUrl: string | null;
  finalizedAt: string | null;
  mockups: Mockup[];
  provider: string | null;
};

const btn: React.CSSProperties = { fontSize: "0.75rem", padding: "0.55rem 0.9rem" };

export function GiftDesigner({
  slug,
  guestOfHonorName,
  sources,
  saved,
  designsOpen,
  owned,
  printify,
  previews,
}: {
  slug: string;
  guestOfHonorName: string;
  sources: Source[];
  saved: Saved[];
  designsOpen: boolean;
  /** Products this party has bought; the rest are offered as extras */
  owned: ProductKey[];
  /** Whether Printify is connected, for real product photos */
  printify: boolean;
  /** Printify photos already made for previewed products */
  previews: { productKey: ProductKey; mockups: Mockup[]; provider: string | null; createdAt: string }[];
}) {
  const sourceMap = useSourceMap(sources);
  const savedMap = useMemo(() => new Map(saved.map((s) => [s.productKey, s])), [saved]);
  const [productKey, setProductKey] = useState<ProductKey>(owned[0]);
  const [previewKey, setPreviewKey] = useState<ProductKey | null>(null);
  const [previewMode, setPreviewMode] = useState<"mockup" | "flat">("mockup");
  const extras = Object.values(PRODUCTS).filter((p) => !owned.includes(p.key));
  const product = PRODUCTS[productKey];

  // One layout per product, kept while switching between them
  const [layouts, setLayouts] = useState<Record<string, Layout>>(() =>
    Object.fromEntries(saved.map((s) => [s.productKey, s.layout])),
  );
  const layout = layouts[productKey] ?? freshLayout(product, sources, "#fffdf6");
  const [status, setStatus] = useState<Record<string, { final: boolean; printUrl: string | null }>>(() =>
    Object.fromEntries(saved.map((s) => [s.productKey, { final: s.status === "final", printUrl: s.printUrl }])),
  );

  const [photos, setPhotos] = useState<Record<string, { mockups: Mockup[]; provider: string | null }>>(() =>
    Object.fromEntries(saved.map((s) => [s.productKey, { mockups: s.mockups, provider: s.provider }])),
  );
  const [photoState, setPhotoState] = useState<"idle" | "loading" | "error">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "flat" | "mockup">("edit");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<Layout[]>([]);
  const future = useRef<Layout[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seed = useRef(7);

  const selected = layout.elements.find((e) => e.id === selectedId) ?? null;
  const warnings = useMemo(() => layoutWarnings(layout, product, sourceMap), [layout, product, sourceMap]);
  const warnIds = useMemo(() => new Set(warnings.map((w) => w.id)), [warnings]);
  const placed = new Set(layout.elements.filter((e) => e.kind === "design").map((e) => (e as { designId: string }).designId));
  const unplaced = sources.filter((s) => !placed.has(s.designId));

  // ---- saving -------------------------------------------------------------
  const scheduleSave = useCallback(
    (next: Layout) => {
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState("saving");
        const res = await saveGiftLayout(slug, productKey, next);
        setSaveState(res.error ? "error" : "saved");
        if (!res.error) setStatus((s) => ({ ...s, [productKey]: { final: false, printUrl: s[productKey]?.printUrl ?? null } }));
      }, 1200);
    },
    [productKey, slug],
  );

  /** Replace the layout. `record` adds an undo step. */
  const setLayout = useCallback(
    (next: Layout, record = true) => {
      if (record) {
        history.current.push(layout);
        if (history.current.length > 60) history.current.shift();
        future.current = [];
      }
      setLayouts((all) => ({ ...all, [productKey]: next }));
      scheduleSave(next);
    },
    [layout, productKey, scheduleSave],
  );

  // Live drag updates don't record history; the drag start snapshot does
  const dragStart = useRef<Layout | null>(null);
  const onChange = (elements: El[]) => {
    if (!dragStart.current) dragStart.current = layout;
    setLayouts((all) => ({ ...all, [productKey]: { ...layout, elements } }));
  };
  const onCommit = () => {
    if (dragStart.current) {
      history.current.push(dragStart.current);
      future.current = [];
      dragStart.current = null;
    }
    scheduleSave(layouts[productKey] ?? layout);
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    future.current.push(layout);
    setLayout(prev, false);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(layout);
    setLayout(next, false);
  };

  // ---- editing actions ----------------------------------------------------
  const patchSelected = (patch: Partial<El>) =>
    selected && setLayout({ ...layout, elements: layout.elements.map((e) => (e.id === selected.id ? ({ ...e, ...patch } as El) : e)) });

  const remove = () => {
    if (!selected) return;
    setLayout({ ...layout, elements: layout.elements.filter((e) => e.id !== selected.id) });
    setSelectedId(null);
  };

  const layer = (dir: "front" | "back") => {
    if (!selected) return;
    const rest = layout.elements.filter((e) => e.id !== selected.id);
    setLayout({ ...layout, elements: dir === "front" ? [...rest, selected] : [selected, ...rest] });
  };

  const addText = (text: string, font: TextEl["font"], y: number, size: number) => {
    const el: TextEl = {
      id: `t-${Date.now()}`,
      kind: "text",
      text,
      font,
      color: "#3b4836",
      x: 0.5,
      y,
      w: Math.min(0.9, text.length * (font === "script" ? 0.42 : 0.55) * size),
      rot: 0,
      size,
    };
    setLayout({ ...layout, elements: [...layout.elements, el] });
    setSelectedId(el.id);
  };

  const addDesign = (s: Source) => {
    const el = {
      id: `d-${s.designId}`,
      kind: "design" as const,
      designId: s.designId,
      aspect: s.height / Math.max(1, s.width),
      x: 0.5,
      y: 0.5,
      w: 0.22,
      rot: 0,
    };
    setLayout({ ...layout, elements: [...layout.elements, el] });
    setSelectedId(el.id);
  };

  const rescatter = () => {
    if (layout.elements.some((e) => e.kind === "design") && !window.confirm("Rearrange every design? You can undo this.")) return;
    seed.current += 1;
    const fresh = freshLayout(product, sources, layout.background, seed.current);
    const texts = layout.elements.filter((e) => e.kind === "text");
    setLayout({ ...layout, elements: [...fresh.elements, ...texts] });
    setSelectedId(null);
  };

  // Keyboard: delete, nudge, undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (!selected || mode !== "edit") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
      }
      const step = e.shiftKey ? 0.02 : 0.004;
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        patchSelected({ x: selected.x + moves[e.key][0], y: selected.y + moves[e.key][1] });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- finalize -----------------------------------------------------------
  async function finalize() {
    if (warnings.length && !window.confirm(`There ${warnings.length === 1 ? "is 1 warning" : `are ${warnings.length} warnings`}. Make the print file anyway?`)) return;
    setFinalizing(true);
    setError(null);
    setSelectedId(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const blob = await renderPrint(product, layout, sourceMap);
      const start = await startGiftPrint(slug, productKey);
      if (!start.ok) throw new Error(start.error);
      const { error: upErr } = await supabaseBrowser()
        .storage.from("prints")
        .uploadToSignedUrl(start.path, start.token, blob, { contentType: blob.type });
      if (upErr) throw new Error("The print file didn't finish uploading. Check your connection and try again.");
      const fin = await finishGiftPrint(slug, productKey, start.path, layout);
      if (fin.error) throw new Error(fin.error);
      setSaveState("saved");
      setStatus((s) => ({ ...s, [productKey]: { final: true, printUrl: URL.createObjectURL(blob) } }));
      setPhotos((p) => ({ ...p, [productKey]: { mockups: [], provider: null } }));
      if (printify) void fetchPhotos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong making the print file.");
    } finally {
      setFinalizing(false);
    }
  }

  async function fetchPhotos() {
    setPhotoState("loading");
    setPhotoError(null);
    const res = await makeGiftMockups(slug, productKey);
    if (res.ok) {
      setPhotos((p) => ({ ...p, [productKey]: { mockups: res.mockups, provider: res.provider } }));
      setPhotoState("idle");
    } else {
      setPhotoError(res.error);
      setPhotoState("error");
    }
  }

  const st = status[productKey];
  const pics = st?.final ? (photos[productKey]?.mockups ?? []) : [];
  const { w: inW, h: inH } = inches(product);

  return (
    <div className="gd">
      {/* Product picker (only when the party has more than one gift) */}
      {owned.length > 1 && (
        <div className="gd-products" role="tablist" aria-label="Product">
          {owned.map((key) => {
            const p = PRODUCTS[key];
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={p.key === productKey && !previewKey}
                className="gd-product"
                onClick={() => {
                  setProductKey(p.key);
                  setPreviewKey(null);
                  setSelectedId(null);
                  history.current = [];
                  future.current = [];
                }}
              >
                <span>{p.name}</span>
                <small>
                  {savedMap.get(p.key) || layouts[p.key] ? (status[p.key]?.final ? "Ready to print ✓" : "Draft") : "Not started"}
                </small>
              </button>
            );
          })}
        </div>
      )}

      {previewKey && (
        <UpsellPreview
          key={previewKey}
          slug={slug}
          productKey={previewKey}
          layout={layout}
          sources={sourceMap}
          printify={printify}
          initialPhotos={previews.find((p) => p.productKey === previewKey) ?? null}
          mode={previewMode}
          setMode={setPreviewMode}
          onBack={() => setPreviewKey(null)}
        />
      )}

      {!previewKey && designsOpen && (
        <p className="pp-note" style={{ fontSize: "0.95rem" }}>
          Guests can still add or change designs until the deadline. You can start arranging now; new designs show up in the tray below.
        </p>
      )}

      <div className="gd-main" hidden={Boolean(previewKey)}>
        <div className="gd-canvas-col">
          {/* Toolbar */}
          <div className="gd-toolbar">
            <div className="gd-seg" role="tablist" aria-label="View">
              {(["edit", "flat", "mockup"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                  {m === "edit" ? "Arrange" : m === "flat" ? "Print view" : "On the product"}
                </button>
              ))}
            </div>
            <span className="gd-save" data-state={saveState}>
              {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved" : saveState === "error" ? "Couldn't save" : "Saved"}
            </span>
          </div>

          <Stage
            product={product}
            layout={layout}
            sources={sourceMap}
            mode={mode}
            selectedId={selectedId}
            warnIds={warnIds}
            onSelect={setSelectedId}
            onChange={onChange}
            onCommit={onCommit}
          />
          <p className="pp-soft" style={{ fontSize: "0.82rem", textAlign: "center", marginTop: "0.5rem" }}>
            {product.name} · {inW.toFixed(0)} × {inH.toFixed(0)} in
            {product.estimated ? " (size to be confirmed)" : ""}
            {mode === "edit" ? " · dashed line = print-safe area" : ""}
          </p>
        </div>

        {/* Side panel */}
        <aside className="gd-panel">
          <section>
            <h3>Arrange</h3>
            <div className="gd-row">
              <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={rescatter}>
                Scatter for me
              </button>
              <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={undo} disabled={!history.current.length}>
                Undo
              </button>
              <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={redo} disabled={!future.current.length}>
                Redo
              </button>
            </div>
            <label className="gd-check">
              <input type="checkbox" checked={layout.snap} onChange={(e) => setLayout({ ...layout, snap: e.target.checked })} />
              Snap lines (line things up neatly)
            </label>
          </section>

          {selected && mode === "edit" && (
            <section>
              <h3>{selected.kind === "text" ? "Text" : `${sourceMap.get(selected.designId)?.guestName ?? "Guest"}'s design`}</h3>
              {selected.kind === "text" && (
                <>
                  <input
                    className="pp-field"
                    value={selected.text}
                    maxLength={120}
                    onChange={(e) => {
                      const text = e.target.value;
                      const ratio = selected.text.length ? text.length / selected.text.length : 1;
                      patchSelected({ text, w: Math.max(0.05, selected.w * (text.length ? ratio : 1)) } as Partial<TextEl>);
                    }}
                  />
                  <div className="gd-row">
                    <select className="pp-field" style={{ width: "auto" }} value={selected.font} onChange={(e) => patchSelected({ font: e.target.value as TextEl["font"] })}>
                      <option value="script">Script</option>
                      <option value="serif">Classic</option>
                    </select>
                    <input type="color" value={selected.color} onChange={(e) => patchSelected({ color: e.target.value })} aria-label="Text colour" />
                  </div>
                </>
              )}
              <div className="gd-row">
                <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={() => layer("front")}>
                  Bring to front
                </button>
                <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={() => layer("back")}>
                  Send to back
                </button>
                <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={() => patchSelected({ rot: 0 })}>
                  Straighten
                </button>
                <button type="button" className="pp-link" style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }} onClick={remove}>
                  Remove
                </button>
              </div>
              <p className="pp-soft" style={{ fontSize: "0.8rem" }}>Drag to move. Use the corner dot to resize and the top dot to rotate.</p>
            </section>
          )}

          <section>
            <h3>Extras</h3>
            <div className="gd-row">
              <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={() => addText(guestOfHonorName, "script", 0.09, 0.09)}>
                + {guestOfHonorName}&apos;s name
              </button>
              <button type="button" className="pp-btn pp-btn-ghost" style={btn} onClick={() => addText("Made with love", "serif", 0.94, 0.035)}>
                + Title
              </button>
            </div>
            <p className="gd-label">Background</p>
            <div className="gd-row" style={{ gap: 6 }}>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="gd-swatch"
                  aria-label={`Background ${c}`}
                  aria-pressed={layout.background.toLowerCase() === c}
                  style={{ background: c }}
                  onClick={() => setLayout({ ...layout, background: c })}
                />
              ))}
              <input type="color" value={layout.background} onChange={(e) => setLayout({ ...layout, background: e.target.value })} aria-label="Custom background colour" />
            </div>
          </section>

          <section>
            <h3>
              Designs ({placed.size} of {sources.length} placed)
            </h3>
            {unplaced.length === 0 ? (
              <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
                {sources.length ? "Every design is on the gift." : "No designs yet. They'll appear here as guests add them."}
              </p>
            ) : (
              <div className="gd-tray">
                {unplaced.map((s) => (
                  <button key={s.designId} type="button" className="gd-tray-item checker" title={`Add ${s.guestName}'s design`} onClick={() => addDesign(s)}>
                    {s.url && <img src={s.url} alt="" />}
                    <span>{s.guestName}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {warnings.length > 0 && (
            <section>
              <h3>Check before printing</h3>
              <ul className="gd-warnings">
                {warnings.map((w, i) => (
                  <li key={i}>
                    <button type="button" className="pp-link" style={{ textAlign: "left", fontSize: "0.9rem" }} onClick={() => { setMode("edit"); setSelectedId(w.id); }}>
                      {w.text}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3>Finish</h3>
            {st?.final && st.printUrl ? (
              <p style={{ fontSize: "0.95rem" }}>
                ✓ Print file is ready.{" "}
                <a href={st.printUrl} download={`${slug}-${productKey}.${product.format === "png" ? "png" : "jpg"}`} className="pp-link">
                  Download it
                </a>
              </p>
            ) : (
              <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
                When it looks just right, make the full-size print file. You can still change things afterwards and make it again.
              </p>
            )}
            {st?.final && printify && (
              <div className="gd-photos">
                {photoState === "loading" ? (
                  <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
                    Getting product photos from Printify…
                  </p>
                ) : pics.length ? (
                  <>
                    <p className="gd-label">Your gift{photos[productKey]?.provider ? ` · printed by ${photos[productKey]?.provider}` : ""}</p>
                    <div className="gd-photo-grid">
                      {pics.slice(0, 6).map((m) => (
                        <a key={m.src} href={m.src} target="_blank" rel="noopener noreferrer">
                          <img src={m.src} alt={`${product.name} (${m.position})`} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    {photoError && <p style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}>{photoError}</p>}
                    <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={fetchPhotos}>
                      {photoError ? "Try again" : "Show it on the real product"}
                    </button>
                  </div>
                )}
              </div>
            )}
            <button type="button" className="pp-btn" onClick={finalize} disabled={finalizing || !layout.elements.length}>
              {finalizing ? "Making print file…" : st?.final ? "Make it again" : "Finalize design"}
            </button>
            {error && (
              <p role="alert" style={{ color: "var(--pp-leather)", marginTop: "0.5rem" }}>
                {error}
              </p>
            )}
          </section>
        </aside>
      </div>

      {/* Extras the host can add to their order */}
      {extras.length > 0 && !previewKey && (
        <section className="gd-extras">
          <h3 className="pp-script" style={{ fontSize: "2rem", color: "var(--pp-accent)" }}>
            Put these designs on more gifts
          </h3>
          <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
            Preview your arrangement on another product, then add it to your order.
          </p>
          <div className="gd-extras-grid">
            {extras.map((p) => (
              <div key={p.key} className="gd-extra">
                <p style={{ fontWeight: 600 }}>{p.name}</p>
                <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
                  {p.blurb}
                </p>
                <button
                  type="button"
                  className="pp-btn pp-btn-ghost"
                  style={btn}
                  onClick={() => {
                    setPreviewKey(p.key);
                    setPreviewMode("mockup");
                    setSelectedId(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Preview it
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Read-only look at the current arrangement on a product the party hasn't bought yet. */
function UpsellPreview({
  slug,
  productKey,
  layout,
  sources,
  printify,
  initialPhotos,
  mode,
  setMode,
  onBack,
}: {
  slug: string;
  productKey: ProductKey;
  layout: Layout;
  sources: Map<string, Source>;
  printify: boolean;
  initialPhotos: { mockups: Mockup[]; provider: string | null; createdAt: string } | null;
  mode: "mockup" | "flat";
  setMode: (m: "mockup" | "flat") => void;
  onBack: () => void;
}) {
  const p = PRODUCTS[productKey];
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function realPhotos() {
    setBusy(true);
    setErr(null);
    try {
      // A smaller file is plenty for photos and much quicker to make
      const scale = Math.min(1, 2000 / Math.max(p.widthPx, p.heightPx));
      const small = { ...p, widthPx: Math.round(p.widthPx * scale), heightPx: Math.round(p.heightPx * scale) };
      const blob = await renderPrint(small, layout, sources);
      const start = await startPreviewUpload(slug, productKey);
      if (!start.ok) throw new Error(start.error);
      const { error: upErr } = await supabaseBrowser()
        .storage.from("prints")
        .uploadToSignedUrl(start.path, start.token, blob, { contentType: blob.type });
      if (upErr) throw new Error("The preview didn't finish uploading. Check your connection and try again.");
      const res = await makePreviewMockups(slug, productKey, start.path);
      if (!res.ok) throw new Error(res.error);
      setPhotos({ mockups: res.mockups, provider: res.provider, createdAt: new Date().toISOString() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gd-preview">
      <div className="gd-toolbar">
        <button type="button" className="pp-link" onClick={onBack}>
          ← Back to my gift
        </button>
        <div className="gd-seg" role="tablist" aria-label="View">
          {(["mockup", "flat"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
              {m === "mockup" ? "On the product" : "Print view"}
            </button>
          ))}
        </div>
      </div>
      <p className="pp-note" style={{ fontSize: "0.95rem", marginBottom: "1rem" }}>
        <strong>{p.name}</strong> preview, using your current arrangement. Once it&apos;s added to your order you can fine-tune
        the layout for this product and make its print file.
      </p>
      <Stage
        product={p}
        layout={layout}
        sources={sources}
        mode={mode}
        selectedId={null}
        warnIds={new Set()}
        onSelect={() => {}}
        onChange={() => {}}
        onCommit={() => {}}
      />
      {printify && (
        <div className="gd-real" style={{ marginTop: "1.5rem" }}>
          {photos?.mockups.length ? (
            <>
              <p className="gd-label">
                The real {p.name.toLowerCase()}
                {photos.provider ? ` · printed by ${photos.provider}` : ""}
              </p>
              <div className="gd-photo-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {photos.mockups.slice(0, 8).map((m) => (
                  <a key={m.src} href={m.src} target="_blank" rel="noopener noreferrer">
                    <img src={m.src} alt={`${p.name} (${m.position})`} loading="lazy" />
                  </a>
                ))}
              </div>
              <p className="pp-soft" style={{ fontSize: "0.82rem" }}>
                Made from your arrangement on{" "}
                {new Date(photos.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.{" "}
                <button type="button" className="pp-link" onClick={realPhotos} disabled={busy}>
                  {busy ? "Updating…" : "Update photos"}
                </button>
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <button type="button" className="pp-btn pp-btn-ghost" onClick={realPhotos} disabled={busy}>
                {busy ? "Getting photos from Printify…" : "See it on the real product"}
              </button>
              {busy && (
                <p className="pp-soft" style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
                  This takes about 10 seconds.
                </p>
              )}
            </div>
          )}
          {err && (
            <p role="alert" style={{ color: "var(--pp-leather)", fontSize: "0.9rem", marginTop: "0.4rem", textAlign: "center" }}>
              {err}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "grid", justifyItems: "center", gap: "0.4rem", marginTop: "1.25rem", textAlign: "center" }}>
        <button type="button" className="pp-btn" disabled title="Checkout opens when the store is connected">
          Add to my order
        </button>
        <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
          Checkout through the Moody Celebrations shop is coming soon.
        </p>
      </div>
    </section>
  );
}
