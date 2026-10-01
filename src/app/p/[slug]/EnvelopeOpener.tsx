"use client";

import { useEffect, useState } from "react";
import { Motif } from "@/components/Motif";
import type { Theme } from "@/themes";

/**
 * "Tap to open" envelope shown over the party page on the first visit in a
 * browser session. Remembers that it was opened so moving around the party
 * doesn't replay it.
 */
export function EnvelopeOpener({
  slug,
  name,
  occasion,
  motif,
}: {
  slug: string;
  name: string;
  occasion: string;
  motif: Theme["motif"];
}) {
  const key = `pp_opened_${slug}`;
  const [state, setState] = useState<"closed" | "opening" | "gone">("closed");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(key)) setState("gone");
    } catch {
      /* storage blocked: just show the envelope */
    }
  }, [key]);

  useEffect(() => {
    if (state === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [state]);

  if (state === "gone") return null;

  const open = () => {
    if (state !== "closed") return;
    setState("opening");
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => setState("gone"), reduce ? 50 : 1600);
  };

  const possessive = name.endsWith("s") ? `${name}'` : `${name}'s`;

  return (
    <div className="pp-opener pp-page" data-open={state !== "closed"}>
      <div style={{ display: "grid", justifyItems: "center", gap: "1.5rem" }}>
        <button
          type="button"
          className="pp-envelope"
          data-open={state !== "closed"}
          onClick={open}
          aria-label={`Open the invitation to ${possessive} ${occasion.toLowerCase()}`}
        >
          <span className="pp-envelope-body" />
          <span className="pp-envelope-card pp-paper" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
            <span>
              <span className="pp-caps pp-soft" style={{ display: "block", fontSize: "0.7rem" }}>
                Welcome to
              </span>
              <span className="pp-script" style={{ display: "block", fontSize: "2.8rem", color: "var(--pp-accent)", margin: "0.3rem 0" }}>
                {possessive}
              </span>
              <span className="pp-caps" style={{ display: "block", fontSize: "0.7rem" }}>
                {occasion}
              </span>
            </span>
          </span>
          <span className="pp-envelope-pocket" />
          <span className="pp-envelope-flap" />
          <span className="pp-tape pp-envelope-tape" style={{ left: "4%", transform: "rotate(28deg)" }} />
          <span className="pp-tape pp-envelope-tape" style={{ right: "4%", transform: "rotate(-28deg)" }} />
          <span className="pp-envelope-seal">
            <span className="pp-seal">
              <Motif motif={motif} size={26} />
            </span>
          </span>
        </button>
        <p className="pp-caps" style={{ fontSize: "0.9rem" }} aria-hidden="true">
          Tap to open
        </p>
      </div>
    </div>
  );
}
