"use client";

import { useEffect, useState } from "react";
import { Ornament } from "@/components/Icon";
import { Motif } from "@/components/Motif";
import type { Theme } from "@/themes";
import type { WrapUp } from "@/lib/wrapup";

export function ThankCardView({
  recipientName,
  message,
  designUrl,
  from,
  guestOfHonorName,
  motif,
  preview,
  wrapUp,
}: {
  recipientName: string;
  message: string;
  designUrl: string | null;
  from: string;
  guestOfHonorName: string;
  motif: Theme["motif"];
  preview: boolean;
  wrapUp: WrapUp | null;
}) {
  const [open, setOpen] = useState(false);
  const [confetti, setConfetti] = useState<{ left: number; delay: number; dur: number; color: string }[]>([]);

  useEffect(() => {
    if (!open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["var(--pp-gold)", "var(--pp-accent)", "var(--pp-gold-light)", "var(--pp-swatch)"];
    setConfetti(
      Array.from({ length: 28 }, (_, i) => ({
        left: Math.random() * 100,
        delay: 0.6 + Math.random() * 0.8,
        dur: 2.6 + Math.random() * 2,
        color: colors[i % colors.length],
      })),
    );
  }, [open]);

  return (
    <main className="tc-stage">
      {preview && (
        <p className="pp-note" style={{ position: "fixed", top: 12, left: 12, right: 12, textAlign: "center", fontSize: "0.9rem", zIndex: 6 }}>
          Preview: this is what {recipientName} will see. Opening it here doesn&apos;t count as them opening it.
        </p>
      )}
      <div>
        <div className="tc-wrap" data-open={open}>
          {/* Inside, right-hand page: the note */}
          <div className="tc-page">
            {designUrl && (
              <div className="tc-mobile-design" style={{ textAlign: "center", marginBottom: "0.6rem" }}>
                <img src={designUrl} alt="Your design" className="tc-design" style={{ maxHeight: 90 }} />
              </div>
            )}
            <div className="tc-message">{message}</div>
          </div>

          {/* Cover: front is the card front, back is the inside left page */}
          <div
            className="tc-cover"
            role="button"
            tabIndex={0}
            aria-label={open ? "Card" : `Open your card from ${from}`}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
          >
            <div className="tc-face tc-front">
              <div className="tc-front-panel">
                <Ornament style={{ color: "#e2c67a", margin: "0 auto" }} />
                <p className="pp-script pp-foil" style={{ fontSize: "clamp(3.4rem, 15vw, 4.6rem)", lineHeight: 0.92, margin: "0.9rem 0 1rem" }}>
                  Thank you
                </p>
                <p className="pp-serif-italic" style={{ fontSize: "1.25rem", opacity: 0.92 }}>
                  for {recipientName}
                </p>
              </div>
            </div>
            <div className="tc-face tc-back">
              {designUrl ? (
                <div style={{ display: "grid", justifyItems: "center", gap: "0.8rem" }}>
                  <img src={designUrl} alt="Your design" className="tc-design" />
                  <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem", lineHeight: 1.6 }}>
                    Your design, now part of
                    <br />
                    {guestOfHonorName}&apos;s gift
                  </p>
                </div>
              ) : (
                <div style={{ color: "var(--pp-gold)", display: "grid", gap: "0.8rem", justifyItems: "center" }}>
                  <Motif motif={motif} size={40} />
                  <p className="pp-script" style={{ fontSize: "2.2rem", color: "var(--pp-accent)" }}>
                    with love
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="tc-hint pp-caps" style={{ fontSize: "0.85rem" }}>
          Tap to open
        </p>
      </div>

      {open && wrapUp && (
        <WrapUpView wrapUp={wrapUp} hasDesign={Boolean(designUrl)} guestOfHonorName={guestOfHonorName} />
      )}

      <div className="tc-confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, color: c.color }}>
            <Motif motif={motif} size={14 + (i % 3) * 4} />
          </span>
        ))}
      </div>
    </main>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function WrapUpView({ wrapUp: w, hasDesign, guestOfHonorName }: { wrapUp: WrapUp; hasDesign: boolean; guestOfHonorName: string }) {
  const first = guestOfHonorName.split(" ")[0];
  const tiles: React.ReactNode[] = [];

  for (const prize of w.rafflePrizes) {
    tiles.push(
      <div className="tc-tile tc-win" key={`win-${prize}`}>
        <p className="pp-caps" style={{ fontSize: "0.62rem" }}>You won the raffle</p>
        <p className="tc-tile-big">{prize}</p>
      </div>,
    );
  }
  for (const g of w.gamePrizes ?? []) {
    tiles.push(
      <div className="tc-tile tc-win" key={`game-${g.game}`}>
        <p className="pp-caps" style={{ fontSize: "0.62rem" }}>You won {g.game}</p>
        <p className="tc-tile-big">{g.prize}</p>
      </div>,
    );
  }
  if (hasDesign) {
    tiles.push(
      <div className="tc-tile" key="design">
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>Your design</p>
        <p className="tc-tile-big">Part of {first}&apos;s gift, forever</p>
      </div>,
    );
  }
  for (const [i, n] of w.notes.entries()) {
    tiles.push(
      <div className="tc-tile" key={`note-${i}`}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>In the guest book</p>
        {n.kind === "text" && n.excerpt ? (
          <p className="tc-quote">&ldquo;{n.excerpt}&rdquo;</p>
        ) : (
          <p className="tc-tile-big">{n.kind === "video" ? "Your video message" : n.kind === "audio" ? "Your voice memo" : "Your note"}</p>
        )}
        {n.kind !== "text" && n.excerpt && <p className="tc-quote" style={{ fontSize: "1.1rem" }}>&ldquo;{n.excerpt}&rdquo;</p>}
      </div>,
    );
  }
  if (w.photos.count) {
    tiles.push(
      <div className="tc-tile" key="photos">
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>In the album</p>
        {w.photos.urls.length > 0 && (
          <div className="tc-thumbs">
            {w.photos.urls.map((u) => (
              <img key={u} src={u} alt="" />
            ))}
          </div>
        )}
        <p className="tc-tile-big">
          {plural(w.photos.count, "photo")} shared
          {w.photos.hearts > 0 && (
            <>
              {" "}
              · {w.photos.hearts} ♥
            </>
          )}
        </p>
      </div>,
    );
  }
  if (w.babyPhoto) {
    tiles.push(
      <div className="tc-tile" key="baby">
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>Guess the baby photo</p>
        <p className="tc-tile-big">
          {w.babyPhoto.correct} of {w.babyPhoto.total} right
        </p>
        <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
          {w.babyPhoto.place === 1 ? "First place" : `${ordinal(w.babyPhoto.place)} place`} of {w.babyPhoto.players}
        </p>
      </div>,
    );
  }
  if (w.pool) {
    tiles.push(
      <div className="tc-tile" key="pool">
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>Due date &amp; weight pool</p>
        <p className="tc-tile-big">{w.pool.place === 1 ? "Closest guess" : `${ordinal(w.pool.place)} closest`}</p>
        <p className="pp-soft" style={{ fontSize: "0.9rem" }}>out of {plural(w.pool.players, "guess", "guesses")}</p>
      </div>,
    );
  }
  if (w.playedGames && !w.babyPhoto && !w.pool) {
    tiles.push(
      <div className="tc-tile" key="games">
        <p className="pp-caps pp-soft" style={{ fontSize: "0.62rem" }}>Games</p>
        <p className="tc-tile-big">You played along!</p>
      </div>,
    );
  }

  const t = w.totals;
  const together = [
    t.designs ? plural(t.designs, "design") : null,
    t.notes ? plural(t.notes, "guest book note") : null,
    t.photos ? plural(t.photos, "photo") : null,
  ].filter(Boolean);

  if (!tiles.length && !together.length) return null;

  return (
    <section className="tc-wrapup" aria-label="Your part in the celebration">
      {tiles.length > 0 && (
        <>
          <p className="pp-script" style={{ fontSize: "2.4rem", color: "var(--pp-accent)", textAlign: "center", lineHeight: 1 }}>
            Your part in the celebration
          </p>
          <div className="tc-tiles">{tiles}</div>
        </>
      )}
      {t.people > 1 && together.length > 0 && (
        <p className="pp-soft" style={{ textAlign: "center", fontSize: "1rem", marginTop: "0.5rem" }}>
          Together, {t.people} people celebrated {first}: {together.join(", ")}.
        </p>
      )}
    </section>
  );
}
