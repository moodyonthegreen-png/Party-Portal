"use client";

import { useState, useTransition } from "react";
import type { GamePrize as Prize } from "@/lib/games/settings";
import { emailGameWinner, setGamePrize, type ActionState } from "../actions";

type Game = "babyPhotos" | "pool";
type Winner = { key: string; name: string; emailedAt: string | null; email: string | null };

const small: React.CSSProperties = { fontSize: "0.9rem", minHeight: "2.5rem", padding: "0.5rem 1rem" };
const label: React.CSSProperties = { display: "block", marginBottom: "0.35rem" };

/** "Give the winner a prize" for one game, and emailing the winners once results are out. */
export function GamePrize({
  slug,
  game,
  prize,
  resultsOut,
  winners,
  canEmail,
}: {
  slug: string;
  game: Game;
  prize: Prize;
  /** Answers revealed / baby's details posted */
  resultsOut: boolean;
  winners: Winner[];
  canEmail: boolean;
}) {
  const [on, setOn] = useState(prize.on);
  const [text, setText] = useState(prize.prize);
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const dirty = on !== prize.on || text.trim() !== prize.prize;

  const run = (fn: () => Promise<ActionState>) => {
    setMsg(null);
    start(async () => setMsg(await fn()));
  };

  return (
    <div className="gp" style={{ opacity: pending ? 0.7 : 1 }}>
      <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer", fontWeight: 500 }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }} />
        Give the winner a prize
      </label>
      {on && (
        <div>
          <label htmlFor={`gp-${game}`} className="pp-caps" style={label}>
            Prize
          </label>
          <input
            id={`gp-${game}`}
            className="pp-field"
            maxLength={80}
            value={text}
            placeholder="e.g. $25 Target gift card"
            onChange={(e) => setText(e.target.value)}
          />
          <p className="pp-soft" style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>
            Guests see the prize on the game. If people tie for first place, they all win.
          </p>
        </div>
      )}
      {dirty && (
        <div>
          <button type="button" className="pp-btn" style={small} disabled={pending} onClick={() => run(() => setGamePrize(slug, game, { on, prize: text }))}>
            Save prize
          </button>
        </div>
      )}

      {prize.on && prize.prize && !dirty && (
        resultsOut ? (
          winners.length ? (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <p className="pp-caps">
                {winners.length === 1 ? "Winner" : "Winners (tied for first)"}: {prize.prize}
              </p>
              {winners.map((w) => (
                <WinnerRow key={w.key} slug={slug} game={game} winner={w} canEmail={canEmail} />
              ))}
            </div>
          ) : (
            <p className="pp-soft" style={{ fontSize: "0.9rem" }}>Nobody has a winning score yet.</p>
          )
        ) : (
          <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
            The winner appears here once you {game === "babyPhotos" ? "reveal the answers" : "post the results"}.
          </p>
        )
      )}

      {msg?.error && <p role="alert" style={{ color: "var(--pp-leather)" }}>{msg.error}</p>}
      {msg?.message && <p style={{ color: "var(--pp-accent)" }}>{msg.message}</p>}
    </div>
  );
}

function WinnerRow({ slug, game, winner, canEmail }: { slug: string; game: Game; winner: Winner; canEmail: boolean }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(winner.email ?? "");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ border: "1px dashed var(--pp-paper-edge)", borderRadius: 10, padding: "0.8rem 0.9rem", display: "grid", gap: "0.55rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <span className="pp-display" style={{ fontSize: "1.6rem", lineHeight: 1 }}>
          {winner.name}
        </span>
        {winner.emailedAt && <span className="pp-soft" style={{ fontSize: "0.85rem" }}>Prize email sent ✓</span>}
      </div>
      {canEmail && (
        <div>
          <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => setOpen(!open)}>
            {winner.emailedAt ? "Email them again" : "Email the winner"}
          </button>
        </div>
      )}
      {open && canEmail && (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <div>
            <label htmlFor={`gw-${game}-${winner.key}`} className="pp-caps" style={label}>
              Their email
            </label>
            <input id={`gw-${game}-${winner.key}`} type="email" className="pp-field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`gd-${game}-${winner.key}`} className="pp-caps" style={label}>
              Prize details (optional)
            </label>
            <textarea
              id={`gd-${game}-${winner.key}`}
              className="pp-field"
              rows={3}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Paste the gift card link or code, or how they'll receive it"
            />
            <p className="pp-soft" style={{ fontSize: "0.82rem", marginTop: "0.3rem" }}>
              This goes straight into the email and isn&apos;t saved anywhere.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="pp-btn"
              style={small}
              disabled={pending || !to.trim()}
              onClick={() =>
                start(async () => {
                  const res = await emailGameWinner(slug, game, winner.key, to, details);
                  setMsg(res);
                  if (res.ok) {
                    setOpen(false);
                    setDetails("");
                  }
                })
              }
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
      {msg?.error && <p role="alert" style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}>{msg.error}</p>}
      {msg?.message && <p style={{ color: "var(--pp-accent)", fontSize: "0.9rem" }}>{msg.message}</p>}
    </div>
  );
}
