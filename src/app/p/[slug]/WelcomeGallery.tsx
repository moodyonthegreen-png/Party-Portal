"use client";

import { useEffect, useState } from "react";

/** The host's welcome photos: a row of prints, tap one to see it large. */
export function WelcomeGallery({ photos }: { photos: { id: string; url: string; caption: string | null }[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  const cur = open === null ? null : photos[open];
  return (
    <>
      <ul className="wg" aria-label="Photos from the host">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(i)} aria-label={p.caption ? `Open photo: ${p.caption}` : "Open photo"}>
              <img src={p.url} alt={p.caption ?? ""} loading="lazy" />
            </button>
            {p.caption && <span>{p.caption}</span>}
          </li>
        ))}
      </ul>
      {cur && (
        <div className="pp-lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setOpen(null)}>
          <figure onClick={(e) => e.stopPropagation()} className="pp-print" style={{ maxWidth: "min(92vw, 760px)" }}>
            <img src={cur.url} alt={cur.caption ?? ""} style={{ width: "100%", maxHeight: "72vh", objectFit: "contain", background: "#f1f3ec" }} />
            <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", paddingTop: 8 }}>
              <span className="pp-hand" style={{ fontSize: "1.2rem" }}>{cur.caption}</span>
              <span style={{ display: "flex", gap: "0.9rem", flex: "none" }}>
                <button type="button" className="pp-link" disabled={open === 0} onClick={() => setOpen((i) => (i ?? 0) - 1)}>
                  Previous
                </button>
                <button type="button" className="pp-link" disabled={open === photos.length - 1} onClick={() => setOpen((i) => (i ?? 0) + 1)}>
                  Next
                </button>
                <button type="button" className="pp-link" onClick={() => setOpen(null)}>
                  Close
                </button>
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
