"use client";

import { useState, useTransition } from "react";
import type { Photo } from "@/lib/photos";
import { deletePhoto, setPhotoHidden, type ActionState } from "../actions";

export function HostPhotos({ slug, photos }: { slug: string; photos: Photo[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  if (!photos.length) {
    return (
      <p className="pp-soft" style={{ marginTop: "1.25rem" }}>
        No photos yet.
      </p>
    );
  }

  const hiddenCount = photos.filter((p) => p.hidden).length;

  return (
    <div style={{ marginTop: "1.25rem", opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
      <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
        {photos.length} {photos.length === 1 ? "photo" : "photos"}
        {hiddenCount ? ` · ${hiddenCount} hidden` : ""}
      </p>
      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)", marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          marginTop: "0.75rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "1rem",
        }}
      >
        {photos.map((p) => (
          <li key={p.id} style={{ opacity: p.hidden ? 0.45 : 1 }}>
            <div style={{ aspectRatio: "1", background: "#eee", borderRadius: 6, overflow: "hidden" }}>
              {p.url && <img src={p.url} alt={p.caption ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <p style={{ marginTop: 6, fontSize: "0.95rem", fontWeight: 500 }}>{p.authorName}</p>
            {p.caption && (
              <p className="pp-soft" style={{ fontSize: "0.85rem", lineHeight: 1.3 }}>
                {p.caption}
              </p>
            )}
            <p className="pp-soft" style={{ fontSize: "0.8rem" }}>
              ♥ {p.hearts}
              {p.hidden ? " · Hidden" : ""}
            </p>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: 4, fontSize: "0.85rem" }}>
              {p.originalUrl && (
                <a href={p.originalUrl} target="_blank" rel="noopener noreferrer" className="pp-link">
                  Full quality
                </a>
              )}
              <button type="button" className="pp-link" onClick={() => run(() => setPhotoHidden(slug, p.id, !p.hidden))}>
                {p.hidden ? "Show" : "Hide"}
              </button>
              <button
                type="button"
                className="pp-link"
                style={{ color: "var(--pp-leather)" }}
                onClick={() => run(() => deletePhoto(slug, p.id), `Delete this photo from ${p.authorName} for good?`)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
