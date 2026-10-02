"use client";

import { useEffect, useState } from "react";
import { Motif } from "@/components/Motif";
import type { Theme } from "@/themes";

export function ThankCardView({
  recipientName,
  message,
  designUrl,
  from,
  guestOfHonorName,
  motif,
  preview,
}: {
  recipientName: string;
  message: string;
  designUrl: string | null;
  from: string;
  guestOfHonorName: string;
  motif: Theme["motif"];
  preview: boolean;
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
                <div style={{ color: "var(--pp-gold)", marginBottom: "0.6rem" }}>
                  <Motif motif={motif} size={26} />
                </div>
                <p className="pp-script" style={{ fontSize: "clamp(3rem, 14vw, 4.2rem)", color: "var(--pp-accent)", lineHeight: 0.95 }}>
                  Thank you
                </p>
                <p className="pp-caps pp-soft" style={{ fontSize: "0.66rem", marginTop: "1rem" }}>
                  For {recipientName}
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
