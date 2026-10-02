"use client";

import { useState, useTransition } from "react";
import { RULE_LABELS } from "@/lib/games/raffle";
import { MAX_PRIZES, type RaffleRules, type RaffleSettings } from "@/lib/games/settings";
import { clearRaffleWinner, drawRaffleWinner, emailRaffleWinner, saveRaffle, type ActionState } from "../actions";

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", display: "grid", gap: "1rem" };
const small: React.CSSProperties = { fontSize: "0.8rem", padding: "0.65rem 1rem" };
const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };

export type RaffleEntrantRow = { key: string; name: string; entries: number; reasons: string[]; email: string | null };

function Msg({ state }: { state: ActionState | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" style={{ color: "var(--pp-leather)" }}>
        {state.error}
      </p>
    );
  if (state.message) return <p style={{ color: "var(--pp-accent)" }}>{state.message}</p>;
  return null;
}

export function RaffleHost({
  slug,
  raffle,
  entrants,
  canEmail,
}: {
  slug: string;
  raffle: RaffleSettings;
  entrants: RaffleEntrantRow[];
  canEmail: boolean;
}) {
  const [on, setOn] = useState(raffle.on);
  const [prizes, setPrizes] = useState<string[]>(raffle.prizes.length ? raffle.prizes : [""]);
  const [rules, setRules] = useState<RaffleRules>(raffle.rules);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setState(null);
    start(async () => setState(await fn()));
  };

  const totalEntries = entrants.reduce((n, e) => n + e.entries, 0);
  const dirty =
    on !== raffle.on ||
    JSON.stringify(prizes.map((p) => p.trim()).filter(Boolean)) !== JSON.stringify(raffle.prizes) ||
    JSON.stringify(rules) !== JSON.stringify(raffle.rules);
  const byKey = new Map(entrants.map((e) => [e.key, e]));

  return (
    <section className="pp-paper" style={{ ...card, opacity: pending ? 0.7 : 1 }} id="raffle">
      <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
        Raffle
      </h2>
      <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
        A little thank-you for joining in. Guests are entered automatically when they do the things you pick below, so
        there&apos;s nothing to sign up for. Each activity counts as one entry.
      </p>

      <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }} />
        Show the raffle to guests
      </label>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        <span className="pp-caps" style={label}>
          {prizes.length > 1 ? "Prizes (one winner each)" : "Prize"}
        </span>
        {prizes.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              aria-label={`Prize ${i + 1}`}
              className="pp-field"
              maxLength={80}
              value={p}
              placeholder={i === 0 ? "e.g. $25 Starbucks gift card" : "Another prize"}
              onChange={(e) => setPrizes(prizes.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {prizes.length > 1 && (
              <button type="button" className="pp-link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: "0.85rem" }} onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
        ))}
        {prizes.length < MAX_PRIZES && (
          <div>
            <button type="button" className="pp-link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: "0.9rem", padding: 0 }} onClick={() => setPrizes([...prizes, ""])}>
              + Add another prize
            </button>
          </div>
        )}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "0.45rem" }}>
        <legend className="pp-caps" style={{ ...label, marginBottom: "0.5rem" }}>
          Guests are entered when they…
        </legend>
        {(Object.keys(RULE_LABELS) as (keyof RaffleRules)[]).map((k) => (
          <label key={k} style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.checked })} style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }} />
            {RULE_LABELS[k].short.replace(/^./, (c) => c.toUpperCase())}
          </label>
        ))}
      </fieldset>

      <div>
        <button type="button" className="pp-btn" style={small} disabled={pending || !dirty} onClick={() => run(() => saveRaffle(slug, { on, prizes, rules }))}>
          Save raffle
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.8rem" }}>
        <p>
          <strong>{entrants.length}</strong> {entrants.length === 1 ? "guest is" : "guests are"} entered
          {entrants.length ? (
            <>
              {" "}
              with <strong>{totalEntries}</strong> {totalEntries === 1 ? "entry" : "entries"}.
            </>
          ) : (
            "."
          )}
          {dirty && <span className="pp-soft"> (Save to update this.)</span>}
        </p>
        {entrants.length > 0 && (
          <div>
            <button type="button" className="pp-link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: "0.9rem", padding: 0 }} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Hide entries" : "See who's entered"}
            </button>
            {showAll && (
              <table className="pp-board-table" style={{ marginTop: "0.5rem" }}>
                <tbody>
                  {entrants.map((e) => (
                    <tr key={e.key}>
                      <td>{e.name}</td>
                      <td className="pp-soft" style={{ fontSize: "0.85rem" }}>
                        {e.reasons.join(", ")}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {e.entries} {e.entries === 1 ? "entry" : "entries"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {raffle.prizes.map((prize, i) => (
          <PrizeRow
            key={`${prize}-${i}`}
            slug={slug}
            index={i}
            prize={prize}
            winner={raffle.winners[i] ?? null}
            email={raffle.winners[i] ? (byKey.get(raffle.winners[i]!.key)?.email ?? null) : null}
            canDraw={entrants.length > 0}
            canEmail={canEmail}
            run={run}
            pending={pending}
          />
        ))}
        <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
          Winners show on the guest games page as soon as you draw. Each person can win once. If a winner can&apos;t be
          reached, draw again.
        </p>
      </div>
      <Msg state={state} />
    </section>
  );
}

function PrizeRow({
  slug,
  index,
  prize,
  winner,
  email,
  canDraw,
  canEmail,
  run,
  pending,
}: {
  slug: string;
  index: number;
  prize: string;
  winner: RaffleSettings["winners"][number];
  email: string | null;
  canDraw: boolean;
  canEmail: boolean;
  run: (fn: () => Promise<ActionState>, confirmText?: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(email ?? "");
  const [details, setDetails] = useState("");

  return (
    <div style={{ border: "1px dashed var(--pp-paper-edge)", borderRadius: 10, padding: "0.9rem 1rem", display: "grid", gap: "0.6rem" }}>
      <p className="pp-caps" style={{ fontSize: "0.7rem" }}>
        {prize}
      </p>
      {winner ? (
        <>
          <p className="pp-script" style={{ fontSize: "2rem", color: "var(--pp-accent)", lineHeight: 1 }}>
            {winner.name}
          </p>
          <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
            Drawn {new Date(winner.drawnAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {winner.emailedAt ? " · prize email sent ✓" : ""}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {canEmail && (
              <button type="button" className="pp-btn" style={small} onClick={() => setOpen(!open)}>
                {winner.emailedAt ? "Email them again" : "Email the winner"}
              </button>
            )}
            <button type="button" className="pp-btn pp-btn-ghost" style={small} disabled={pending} onClick={() => run(() => drawRaffleWinner(slug, index), `Draw a new winner for "${prize}"? ${winner.name} won't be picked again.`)}>
              Draw again
            </button>
            <button type="button" className="pp-link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: "0.85rem" }} disabled={pending} onClick={() => run(() => clearRaffleWinner(slug, index), "Clear this winner? Guests will stop seeing it.")}>
              Clear
            </button>
          </div>
          {open && canEmail && (
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <div>
                <label htmlFor={`rw-to-${index}`} className="pp-caps" style={label}>
                  Their email
                </label>
                <input id={`rw-to-${index}`} type="email" className="pp-field" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <label htmlFor={`rw-d-${index}`} className="pp-caps" style={label}>
                  Prize details (optional)
                </label>
                <textarea
                  id={`rw-d-${index}`}
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
                    run(async () => {
                      const res = await emailRaffleWinner(slug, index, to, details);
                      if (res.ok) {
                        setOpen(false);
                        setDetails("");
                      }
                      return res;
                    })
                  }
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div>
          <button type="button" className="pp-btn" style={small} disabled={pending || !canDraw} onClick={() => run(() => drawRaffleWinner(slug, index), `Draw the winner for "${prize}" now?`)}>
            Draw a winner
          </button>
        </div>
      )}
    </div>
  );
}
