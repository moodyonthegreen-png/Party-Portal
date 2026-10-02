"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/photos";
import { resizeToJpeg } from "@/lib/image/resize";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { deleteMyPhoto, finishPhoto, startPhoto, toggleHeart } from "./actions";
import { PhotoBooth } from "./PhotoBooth";

const DISPLAY_MAX = 1600;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_AT_ONCE = 20;
const TILTS = [-2.2, 1.6, -1, 2.4, -1.8, 1.1];

type Pending = { key: string; file: File; preview: string; caption: string; error?: string };

function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" ? "image/heic" : ext === "heif" ? "image/heif" : "image/jpeg";
}

export function Album({
  slug,
  guestOfHonorName,
  photos,
  theme,
  occasion,
  eventDate,
}: {
  slug: string;
  guestOfHonorName: string;
  photos: Photo[];
  theme: string;
  occasion: string;
  eventDate: string | null;
}) {
  const [quick, setQuick] = useState(false);
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [hearts, setHearts] = useState<Record<string, { n: number; on: boolean }>>({});

  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [nameKey]);

  useEffect(() => {
    setHearts(Object.fromEntries(photos.map((p) => [p.id, { n: p.hearts, on: p.hearted }])));
  }, [photos]);

  function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    setDone(null);
    const room = MAX_AT_ONCE - pending.length;
    if (files.length > room) setError(`You can add up to ${MAX_AT_ONCE} photos at a time.`);
    const next = files.slice(0, Math.max(0, room)).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      caption: "",
      error: file.size > MAX_BYTES ? "Too large (25 MB limit)" : undefined,
    }));
    setPending((p) => [...p, ...next]);
  }

  async function upload() {
    if (!name.trim()) {
      setError("Please add your name first.");
      return;
    }
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    setError(null);
    const queue = pending.filter((p) => !p.error);
    let added = 0;
    const failed: Pending[] = pending.filter((p) => p.error);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setProgress(`Adding ${i + 1} of ${queue.length}…`);
      try {
        let display;
        try {
          display = await resizeToJpeg(item.file, DISPLAY_MAX);
        } catch {
          throw new Error("This photo format couldn't be opened here. Try a JPEG.");
        }
        const mime = mimeOf(item.file);
        const res = await startPhoto(slug, { name, caption: item.caption, originalMime: mime, originalSize: item.file.size });
        if (!res.ok) throw new Error(res.error);
        const bucket = supabaseBrowser().storage.from("photos");
        const [a, b] = await Promise.all([
          bucket.uploadToSignedUrl(res.display.path, res.display.token, display.blob, { contentType: "image/jpeg" }),
          bucket.uploadToSignedUrl(res.original.path, res.original.token, item.file, { contentType: mime }),
        ]);
        if (a.error || b.error) throw new Error("Upload didn't finish. Check your connection.");
        const fin = await finishPhoto(slug, res.id, { width: display.width, height: display.height });
        if (!fin.ok) throw new Error(fin.error);
        added++;
      } catch (err) {
        failed.push({ ...item, error: err instanceof Error ? err.message : "Something went wrong." });
      }
    }

    setProgress(null);
    setPending(failed);
    if (added) {
      setDone(`Added ${added} ${added === 1 ? "photo" : "photos"}. Thank you!`);
      router.refresh();
    }
    if (failed.length) setError("Some photos couldn't be added. You can try those again.");
  }

  async function heart(p: Photo) {
    const cur = hearts[p.id] ?? { n: p.hearts, on: p.hearted };
    setHearts((h) => ({ ...h, [p.id]: { n: cur.n + (cur.on ? -1 : 1), on: !cur.on } })); // instant feedback
    const res = await toggleHeart(slug, p.id);
    if (res.ok) setHearts((h) => ({ ...h, [p.id]: { n: res.hearts, on: res.hearted } }));
    else setHearts((h) => ({ ...h, [p.id]: cur }));
  }

  async function remove(p: Photo) {
    if (!window.confirm("Remove your photo from the album?")) return;
    const res = await deleteMyPhoto(slug, p.id);
    if (!res.ok) setError(res.error);
    else {
      setOpen(null);
      router.refresh();
    }
  }

  const busy = progress !== null;

  return (
    <>
      <PhotoBooth
        slug={slug}
        theme={theme}
        guestOfHonorName={guestOfHonorName}
        occasion={occasion}
        eventDate={eventDate}
        onQuickUpload={() => setQuick(true)}
      />

      {/* Add several photos at once, without the booth */}
      {quick && (
      <section
        className="pp-paper"
        style={{ maxWidth: "34rem", margin: "1.75rem auto 0", padding: "1.5rem 1.25rem" }}
      >
        <div style={{ display: "grid", gap: "0.9rem" }}>
          <div>
            <label htmlFor="ph-name" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
              Your name
            </label>
            <input id="ph-name" className="pp-field" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="e.g. Aunt Mimi" />
          </div>

          {pending.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.8rem" }}>
              {pending.map((p) => (
                <li key={p.key} style={{ display: "flex", gap: "0.8rem", alignItems: "flex-start" }}>
                  <div style={{ width: 72, height: 72, flexShrink: 0, background: "#fff", padding: 4, boxShadow: "0 2px 6px rgb(0 0 0 / .15)" }}>
                    <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      className="pp-field"
                      style={{ fontSize: "1rem", padding: "0.55rem 0.75rem" }}
                      placeholder="Add a caption (optional)"
                      maxLength={200}
                      value={p.caption}
                      disabled={busy}
                      onChange={(e) => setPending((all) => all.map((x) => (x.key === p.key ? { ...x, caption: e.target.value } : x)))}
                    />
                    <div style={{ display: "flex", gap: "1rem", marginTop: 4, fontSize: "0.85rem" }}>
                      {p.error && <span style={{ color: "var(--pp-leather)" }}>{p.error}</span>}
                      {!busy && (
                        <button type="button" className="pp-link" onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={choose} />
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {pending.length === 0 ? (
              <button type="button" className="pp-btn" onClick={() => input.current?.click()}>
                Choose photos
              </button>
            ) : (
              <>
                <button type="button" className="pp-btn" onClick={upload} disabled={busy || !pending.some((p) => !p.error)}>
                  {progress ?? `Add ${pending.filter((p) => !p.error).length} to the album`}
                </button>
                {!busy && (
                  <button type="button" className="pp-link" onClick={() => input.current?.click()}>
                    + More photos
                  </button>
                )}
              </>
            )}
          </div>
          {error && (
            <p role="alert" style={{ color: "var(--pp-leather)" }}>
              {error}
            </p>
          )}
          {done && (
            <p role="status" style={{ color: "var(--pp-accent)" }}>
              {done}
            </p>
          )}
        </div>
      </section>
      )}

      {/* The album */}
      {photos.length === 0 ? (
        <p className="pp-soft" style={{ textAlign: "center", marginTop: "2.5rem" }}>
          No photos yet. Share the first one with {guestOfHonorName}!
        </p>
      ) : (
        <ul className="pp-album" aria-label="Photos">
          {photos.map((p, i) => {
            const h = hearts[p.id] ?? { n: p.hearts, on: p.hearted };
            return (
              <li key={p.id} className="pp-album-item">
                <figure className="pp-print">
                  <button type="button" className="pp-print-photo" onClick={() => setOpen(p)} aria-label={`Open photo from ${p.authorName}`}>
                    {p.url && <img src={p.url} alt={p.caption ?? `Photo from ${p.authorName}`} loading="lazy" />}
                  </button>
                  <figcaption>
                    {p.caption && <span className="pp-hand pp-print-caption">{p.caption}</span>}
                    {p.story && (
                      <span className="pp-print-story">
                        <span className="pp-print-prompt">{p.prompt === "memory" ? "A memory" : "Hello!"}</span> {p.story}
                      </span>
                    )}
                    <span className="pp-print-by">— {p.authorName}</span>
                  </figcaption>
                  <button
                    type="button"
                    className="pp-heart"
                    data-on={h.on}
                    onClick={() => heart(p)}
                    aria-pressed={h.on}
                    aria-label={h.on ? "Remove your heart" : "Heart this photo"}
                  >
                    <span aria-hidden="true">{h.on ? "♥" : "♡"}</span> {h.n > 0 ? h.n : ""}
                  </button>
                </figure>
              </li>
            );
          })}
        </ul>
      )}

      {/* Full-size view */}
      {open && (
        <div className="pp-lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setOpen(null)}>
          <figure onClick={(e) => e.stopPropagation()} className="pp-print" style={{ maxWidth: "min(92vw, 720px)", transform: "none" }}>
            {open.url && <img src={open.url} alt={open.caption ?? ""} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", background: "#f4f1ea" }} />}
            <figcaption>
              {open.caption && <span className="pp-hand pp-print-caption">{open.caption}</span>}
              {open.story && (
                <span className="pp-print-story" data-full="true">
                  <span className="pp-print-prompt">{open.prompt === "memory" ? `A memory of ${guestOfHonorName.split(" ")[0]}` : `How I know ${guestOfHonorName.split(" ")[0]}`}</span>
                  <br />
                  {open.story}
                </span>
              )}
              <span className="pp-print-by">— {open.authorName}</span>
            </figcaption>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {open.mine ? (
                <button type="button" className="pp-link" style={{ fontSize: "0.85rem" }} onClick={() => remove(open)}>
                  Remove my photo
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="pp-link" style={{ fontSize: "0.85rem" }} onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </figure>
        </div>
      )}
    </>
  );
}
