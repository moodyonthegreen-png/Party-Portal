"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * One game in the host's game library: the name, a line about it, and an
 * "Add to party" switch. The setup details only open once the game is added.
 */
export function GameCard({
  id,
  title,
  blurb,
  on,
  onToggle,
  status,
  error,
  busy = false,
  children,
}: {
  id: string;
  title: string;
  blurb: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  /** Short line shown on an added game, e.g. "5 played" */
  status?: React.ReactNode;
  /** Shown even when the details are closed, so a failed switch is explained */
  error?: string | null;
  busy?: boolean;
  children: React.ReactNode;
}) {
  // Added games start folded up so the library stays easy to scan
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const was = useRef(on);
  // Adding a game opens its details; removing it closes them
  useEffect(() => {
    if (was.current === on) return;
    was.current = on;
    setOpen(on);
  }, [on]);

  return (
    <section className="pp-paper gl-card" data-on={on} id={id} style={{ opacity: busy ? 0.7 : 1 }}>
      <div className="gl-head">
        <button
          type="button"
          className="gl-title"
          onClick={() => (on ? setOpen(!open) : onToggle(true))}
          aria-expanded={on ? open : undefined}
          aria-controls={on ? bodyId : undefined}
        >
          <span className="gl-name">
            {title}
            {on && (
              <svg className="gl-chevron" data-open={open} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="gl-blurb">{blurb}</span>
          {on && status ? <span className="gl-status">{status}</span> : null}
        </button>
        <label className="gl-switch">
          <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => onToggle(e.target.checked)} />
          <span className="gl-track" aria-hidden="true" />
          <span className="gl-switch-label">{on ? "Added" : "Add"}</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="gl-error">
          {error}
        </p>
      )}
      {on && open && (
        <div className="gl-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}
