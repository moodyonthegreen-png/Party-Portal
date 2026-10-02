"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ornament } from "@/components/Icon";
import { promptHeading } from "@/lib/booth/prompts";
import { Motif } from "@/components/Motif";
import type { RevealData } from "@/lib/reveal";
import type { Theme } from "@/themes";

type Slide =
  | { t: "cover" }
  | { t: "title"; kicker: string; title: string; sub?: string }
  | { t: "note"; note: RevealData["notes"][number] }
  | { t: "photos"; photos: RevealData["photos"] }
  | { t: "booth"; photo: RevealData["photos"][number] }
  | { t: "games" }
  | { t: "designs" }
  | { t: "gift" }
  | { t: "end" };

const PHOTOS_PER_SLIDE = 6;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function RevealView({
  data,
  guestOfHonorName,
  occasion,
  motif,
  partyHref,
  preview,
}: {
  data: RevealData;
  guestOfHonorName: string;
  occasion: string;
  motif: Theme["motif"];
  partyHref: string;
  preview: boolean;
}) {
  const first = guestOfHonorName.split(" ")[0];
  const g = data.games;
  const hasGames = Boolean(g.babyPhoto?.length || g.pool || g.raffle.length);

  const slides = useMemo<Slide[]>(() => {
    const s: Slide[] = [{ t: "cover" }];
    if (data.notes.length) {
      s.push({ t: "title", kicker: "The guest book", title: "Words for you", sub: plural(data.notes.length, "message") });
      for (const note of data.notes) s.push({ t: "note", note });
    }
    if (data.photos.length) {
      s.push({ t: "title", kicker: "The album", title: "Moments shared", sub: plural(data.photos.length, "photo") });
      // Photos with a hello or a memory get a page of their own
      for (const p of data.photos) if (p.story) s.push({ t: "booth", photo: p });
      const plain = data.photos.filter((p) => !p.story);
      for (let i = 0; i < plain.length; i += PHOTOS_PER_SLIDE) s.push({ t: "photos", photos: plain.slice(i, i + PHOTOS_PER_SLIDE) });
    }
    if (hasGames) s.push({ t: "games" });
    if (data.designs.length) s.push({ t: "designs" });
    if (data.gift) s.push({ t: "gift" });
    s.push({ t: "end" });
    return s;
  }, [data, hasGames]);

  const [i, setI] = useState(0);
  const next = useCallback(() => setI((n) => Math.min(n + 1, slides.length - 1)), [slides.length]);
  const back = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") next();
      if (e.key === "ArrowLeft" || e.key === "PageUp") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  // Warm up the next slide's images
  useEffect(() => {
    const n = slides[i + 1];
    const urls = n?.t === "photos" ? n.photos.map((p) => p.url) : n?.t === "booth" ? [n.photo.url] : n?.t === "gift" && data.gift ? [data.gift.imageUrl] : [];
    for (const u of urls) {
      const img = new Image();
      img.src = u;
    }
  }, [i, slides, data.gift]);

  const slide = slides[i];
  const tapZone = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button, audio, video, input")) return;
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) back();
    else next();
  };

  return (
    <main className="rv-stage" onClick={tapZone}>
      <div className="rv-progress" aria-hidden="true">
        <div style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
      </div>
      {preview && <p className="pp-note rv-preview">Preview: opening it here doesn&apos;t count as {first} opening it.</p>}

      <div className="rv-slide" key={i} aria-live="polite">
        {slide.t === "cover" && (
          <div className="rv-center" style={{ width: "min(100%, 440px)" }}>
            <div className="pp-cover" style={{ width: "100%" }}>
              <Ornament />
              <p className="pp-cover-sub" style={{ marginTop: "1.1rem", opacity: 0.92 }}>
                Your {occasion.toLowerCase()} keepsake
              </p>
              <h1 className="pp-cover-name pp-foil">For {first}</h1>
              <p className="pp-cover-meta" style={{ maxWidth: "24ch", lineHeight: 1.45 }}>
                {data.names.length > 1 ? `${data.names.length} people` : "The people who love you"} celebrated you. Here&apos;s
                everything they shared.
              </p>
            </div>
            <button type="button" className="pp-btn" style={{ marginTop: "1.75rem" }} onClick={next}>
              Begin
            </button>
          </div>
        )}

        {slide.t === "title" && (
          <div className="rv-center">
            <Ornament />
            <h2 className="pp-script rv-huge" style={{ marginTop: "1rem" }}>{slide.title}</h2>
            <p className="pp-page-kicker">
              {slide.kicker}
              {slide.sub ? `, ${slide.sub}` : ""}
            </p>
          </div>
        )}

        {slide.t === "note" && (
          <div className="rv-note">
            {slide.note.mediaType === "video" && slide.note.mediaUrl && (
              <video className="rv-media" src={slide.note.mediaUrl} controls playsInline preload="metadata" />
            )}
            {slide.note.mediaType === "audio" && slide.note.mediaUrl && (
              <div style={{ display: "grid", justifyItems: "center", gap: "0.6rem" }}>
                <p className="pp-caps pp-soft" style={{ fontSize: "0.7rem" }}>
                  A voice memo
                </p>
                <audio src={slide.note.mediaUrl} controls preload="metadata" style={{ width: "100%" }} />
              </div>
            )}
            {slide.note.body && <p className="rv-hand">{slide.note.body}</p>}
            <p className="rv-from">— {slide.note.author}</p>
          </div>
        )}

        {slide.t === "photos" && (
          <div className="rv-photos" data-count={slide.photos.length}>
            {slide.photos.map((p, k) => (
              <figure key={p.id} className="rv-polaroid">
                <img src={p.url} alt={p.caption ?? `Photo from ${p.author}`} />
                <figcaption>{p.caption || p.author}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {slide.t === "booth" && (
          <div className="rv-booth">
            <img src={slide.photo.url} alt={`Photo from ${slide.photo.author}`} />
            <div>
              <p className="pp-page-kicker" style={{ marginTop: 0 }}>
                {promptHeading(slide.photo.prompt, first)}
              </p>
              <p className="rv-hand" style={{ marginTop: "0.6rem" }}>
                {slide.photo.story}
              </p>
              <p className="rv-from">— {slide.photo.author}</p>
            </div>
          </div>
        )}

        {slide.t === "games" && (
          <div className="rv-center" style={{ gap: "1.1rem" }}>
            <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
              The games
            </p>
            <h2 className="pp-script rv-big">And the winners are…</h2>
            {g.babyPhoto && g.babyPhoto.length > 0 && (
              <div className="rv-card">
                <p className="pp-caps" style={{ fontSize: "0.68rem" }}>Guess the baby photo</p>
                {g.babyPhoto.map((r) => (
                  <p key={r.name} className="rv-line">
                    {r.name} <span className="pp-soft">· {r.correct} of {r.total}</span>
                  </p>
                ))}
              </div>
            )}
            {g.pool && (
              <div className="rv-card">
                <p className="pp-caps" style={{ fontSize: "0.68rem" }}>Due date &amp; weight pool</p>
                {g.pool.closest.length > 0 && <p className="rv-line">{g.pool.closest.join(", ")}</p>}
                {g.pool.date.length > 0 && <p className="pp-soft">Closest birthday: {g.pool.date.join(", ")}</p>}
                {g.pool.weight.length > 0 && <p className="pp-soft">Closest weight: {g.pool.weight.join(", ")}</p>}
              </div>
            )}
            {g.raffle.length > 0 && (
              <div className="rv-card">
                <p className="pp-caps" style={{ fontSize: "0.68rem" }}>Raffle</p>
                {g.raffle.map((r) => (
                  <p key={r.prize} className="rv-line">
                    {r.name} <span className="pp-soft">· {r.prize}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {slide.t === "designs" && (
          <div className="rv-center" style={{ width: "100%" }}>
            <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
              Made by hand
            </p>
            <h2 className="pp-script rv-big">
              {data.designs.length > 1 ? `${data.designs.length} people drew something for you` : "Someone drew something for you"}
            </h2>
            <div className="rv-designs">
              {data.designs.map((d, k) => (
                <figure key={k}>
                  <div className="checker">
                    <img src={d.url} alt={`Design by ${d.name}`} />
                  </div>
                  <figcaption>{d.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}

        {slide.t === "gift" && data.gift && (
          <div className="rv-center">
            <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
              Your {data.gift.productName.toLowerCase()}
            </p>
            <img src={data.gift.imageUrl} alt={data.gift.productName} className="rv-gift" />
            <p className="pp-script rv-big" style={{ marginTop: "0.8rem" }}>
              Made from {plural(data.designs.length, "design")} by the people who love you
            </p>
            <p className="rv-names">{data.designs.map((d) => d.name).join(" · ")}</p>
          </div>
        )}

        {slide.t === "end" && (
          <div className="rv-center">
            <div style={{ color: "var(--pp-gold)" }}>
              <Motif motif={motif} size={30} />
            </div>
            <h2 className="pp-script rv-huge">With love from</h2>
            <p className="rv-names rv-names-big">{data.names.join(" · ")}</p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1.75rem" }}>
              <button type="button" className="pp-btn" onClick={() => setI(0)}>
                Watch again
              </button>
              <a href={partyHref} className="pp-btn pp-btn-ghost">
                Visit the party page
              </a>
            </div>
          </div>
        )}
      </div>

      <nav className="rv-nav" aria-label="Keepsake">
        <button type="button" onClick={back} disabled={i === 0} aria-label="Back">
          ←
        </button>
        <span className="pp-caps" style={{ fontSize: "0.68rem" }}>
          {i + 1} / {slides.length}
        </span>
        <button type="button" onClick={next} disabled={i === slides.length - 1} aria-label="Next">
          →
        </button>
      </nav>
    </main>
  );
}
