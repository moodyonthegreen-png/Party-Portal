"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ANIMAL_BABIES } from "@/lib/games/animal-babies";
import { MAX_ANIMALS, type AnimalSettings } from "@/lib/games/settings";
import { acceptAnimalAnswer, clearAnimals, setAnimals, type ActionState } from "../actions";
import { GameCard } from "./GameCard";
import { GamePrize } from "./GamePrize";

type Winner = { key: string; name: string; emailedAt: string | null; email: string | null };
/** Per animal: answers guests typed that didn't count, and extras the host already accepted */
export type AnimalReview = { id: string; animal: string; answer: string; wrong: { text: string; count: number }[]; extra: string[] };

const small: React.CSSProperties = { fontSize: "0.85rem", padding: "0.6rem 1rem" };
const MIN = 3;

export function AnimalHost({
  slug,
  game,
  board,
  review,
  winners,
  canEmail,
}: {
  slug: string;
  game: AnimalSettings;
  board: { name: string; correct: number; total: number; place: number }[];
  review: AnimalReview[];
  winners: Winner[];
  canEmail: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [picked, setPicked] = useState<string[]>(game.questions);
  const [choosing, setChoosing] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.error || res.message ? res : null);
      router.refresh();
    });
  };

  const dirty = JSON.stringify(picked) !== JSON.stringify(game.questions);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_ANIMALS ? p : [...p, id]));
  const misses = review.reduce((n, r) => n + r.wrong.length, 0);

  return (
    <GameCard
      id="animals"
      title="Baby animal names"
      blurb="Guests type what each animal's baby is called: joey, cygnet, puggle… Spelling doesn't have to be perfect."
      on={game.on}
      onToggle={(v) => run(() => setAnimals(slug, { on: v }))}
      busy={pending}
      error={msg?.error}
      status={`${game.questions.length} animals · ${board.length} played${game.closed ? " · closed" : ""}`}
    >
      <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
        Guests see one animal at a time and type their answer. Small typos, plurals and &ldquo;a&rdquo; or &ldquo;the&rdquo; still
        count. Then they see their score, the right answers and the leaderboard. One try each.
      </p>

      {/* Animals */}
      <div style={{ display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          <p className="pp-caps" style={{ fontSize: "0.72rem" }}>
            Animals ({picked.length} picked, up to {MAX_ANIMALS})
          </p>
          <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={() => setChoosing(!choosing)}>
            {choosing ? "Done choosing" : "Choose animals"}
          </button>
        </div>
        {choosing ? (
          <ul className="tv-pick an-pick">
            {ANIMAL_BABIES.map((q) => {
              const on = picked.includes(q.id);
              return (
                <li key={q.id}>
                  <label data-on={on}>
                    <input type="checkbox" checked={on} disabled={!on && picked.length >= MAX_ANIMALS} onChange={() => toggle(q.id)} />
                    <span>
                      {q.animal.charAt(0).toUpperCase() + q.animal.slice(1)}
                      <span className="pp-soft tv-pick-a">{q.accepted.join(", ")}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="an-picked">
            {picked
              .map((id) => ANIMAL_BABIES.find((q) => q.id === id))
              .filter(Boolean)
              .map((q) => `${q!.animal} (${q!.accepted[0]})`)
              .join(" · ")}
          </p>
        )}
        {dirty && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="pp-btn"
              style={small}
              disabled={pending || picked.length < MIN}
              onClick={() =>
                run(
                  () => setAnimals(slug, { questions: picked }),
                  board.length ? "Some guests have already played. Their scores will be recounted using the new animals. Save anyway?" : undefined,
                )
              }
            >
              Save animals
            </button>
            <button type="button" className="pp-link" onClick={() => setPicked(game.questions)}>
              Undo changes
            </button>
            {picked.length < MIN && <span className="pp-soft" style={{ fontSize: "0.88rem" }}>Pick at least {MIN}.</span>}
          </div>
        )}
      </div>

      {/* Scores */}
      <div style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.75rem" }}>
        <p>
          <strong>{board.length}</strong> {board.length === 1 ? "guest has" : "guests have"} played.
          {game.closed ? " The game is closed." : ""}
        </p>
        {board.length > 0 && (
          <table className="pp-board-table">
            <tbody>
              {board.slice(0, 10).map((r, i) => (
                <tr key={i}>
                  <td style={{ width: "2.5rem" }}>
                    <span className="pp-place" data-top={r.place === 1}>
                      {r.place}
                    </span>
                  </td>
                  <td>{r.name}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.correct} / {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Answers that didn't count: the host can accept them for everyone */}
        {(misses > 0 || review.some((r) => r.extra.length)) && (
          <div className="an-review">
            <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={() => setReviewing(!reviewing)}>
              {reviewing ? "Hide answers that didn't count" : `Check answers that didn't count (${misses})`}
            </button>
            {reviewing && (
              <>
                <p className="pp-soft" style={{ fontSize: "0.88rem" }}>
                  Think one should count? Tap it to accept it for everyone who typed it. Scores update right away.
                </p>
                {review
                  .filter((r) => r.wrong.length || r.extra.length)
                  .map((r) => (
                    <div key={r.id} className="an-review-row">
                      <p>
                        <strong>{r.animal.charAt(0).toUpperCase() + r.animal.slice(1)}</strong>{" "}
                        <span className="pp-soft">· {r.answer}</span>
                      </p>
                      <div className="an-chips">
                        {r.extra.map((t) => (
                          <button
                            key={`x-${t}`}
                            type="button"
                            className="an-chip"
                            data-on="true"
                            title="Accepted. Tap to stop counting it."
                            onClick={() => run(() => acceptAnimalAnswer(slug, r.id, t, false))}
                          >
                            ✓ {t}
                          </button>
                        ))}
                        {r.wrong.map((w) => (
                          <button key={w.text} type="button" className="an-chip" title="Tap to count this as right" onClick={() => run(() => acceptAnimalAnswer(slug, r.id, w.text, true))}>
                            {w.text}
                            {w.count > 1 ? ` ×${w.count}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {game.closed ? (
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => run(() => setAnimals(slug, { closed: false }))}>
              Reopen the game
            </button>
          ) : (
            <button
              type="button"
              className="pp-btn"
              style={small}
              onClick={() => run(() => setAnimals(slug, { closed: true }), "Close the game? Nobody else can play, and the top score wins.")}
            >
              Close the game &amp; pick the winner
            </button>
          )}
          {board.length > 0 && (
            <button
              type="button"
              className="pp-link"
              style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}
              onClick={() => run(() => clearAnimals(slug), "Clear everyone's answers so they can play again?")}
            >
              Start over
            </button>
          )}
        </div>
      </div>
      <GamePrize slug={slug} game="animals" prize={game.prize} resultsOut={game.closed} winners={winners} canEmail={canEmail} />
      {msg?.message && <p style={{ color: "var(--pp-accent)" }}>{msg.message}</p>}
    </GameCard>
  );
}
