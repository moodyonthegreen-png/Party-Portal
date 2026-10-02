"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAX_TRIVIA, type TriviaSettings } from "@/lib/games/settings";
import { TRIVIA_BANK } from "@/lib/games/trivia-bank";
import { clearTrivia, setTrivia, type ActionState } from "../actions";
import { GameCard } from "./GameCard";
import { GamePrize } from "./GamePrize";

type Winner = { key: string; name: string; emailedAt: string | null; email: string | null };
const small: React.CSSProperties = { fontSize: "0.85rem", padding: "0.6rem 1rem" };
const MIN = 3;

export function TriviaHost({
  slug,
  game,
  board,
  winners,
  canEmail,
}: {
  slug: string;
  game: TriviaSettings;
  board: { name: string; correct: number; total: number; place: number }[];
  winners: Winner[];
  canEmail: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [picked, setPicked] = useState<string[]>(game.questions);
  const [showAll, setShowAll] = useState(false);

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
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_TRIVIA ? p : [...p, id]));
  const shuffle = () => {
    const ids = TRIVIA_BANK.map((q) => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    // Keep the bank's order so the quiz flows the same way the list reads
    const chosen = new Set(ids.slice(0, 10));
    setPicked(TRIVIA_BANK.map((q) => q.id).filter((id) => chosen.has(id)));
  };
  // The whole bank in a steady order, so nothing jumps while ticking boxes
  const listed = showAll ? TRIVIA_BANK : null;

  return (
    <GameCard
      id="trivia"
      title="Baby trivia"
      blurb="Multiple-choice questions about babies, from soft spots to first steps. Highest score wins."
      on={game.on}
      onToggle={(v) => run(() => setTrivia(slug, { on: v }))}
      busy={pending}
      error={msg?.error}
      status={`${game.questions.length} questions · ${board.length} played${game.closed ? " · closed" : ""}`}
    >
      <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
        Guests answer one question at a time, then see their score, the right answers with a fun fact for each, and the
        leaderboard. One try each.
      </p>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
          <p className="pp-caps" style={{ fontSize: "0.72rem" }}>
            Questions ({picked.length} picked, up to {MAX_TRIVIA})
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={shuffle}>
              Pick 10 for me
            </button>
            <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={() => setShowAll(!showAll)}>
              {showAll ? "Done choosing" : "Choose questions"}
            </button>
          </div>
        </div>

        {listed ? (
          <ul className="tv-pick">
            {listed.map((q) => {
              const on = picked.includes(q.id);
              return (
                <li key={q.id}>
                  <label data-on={on}>
                    <input type="checkbox" checked={on} disabled={!on && picked.length >= MAX_TRIVIA} onChange={() => toggle(q.id)} />
                    <span>
                      {q.q}
                      <span className="pp-soft tv-pick-a">Answer: {q.options[q.answer]}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <ol className="tv-picked">
            {picked.map((id) => {
              const q = TRIVIA_BANK.find((x) => x.id === id);
              return q ? <li key={id}>{q.q}</li> : null;
            })}
          </ol>
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
                  () => setTrivia(slug, { questions: picked }),
                  board.length ? "Some guests have already played. Their scores will be recounted using the new questions. Save anyway?" : undefined,
                )
              }
            >
              Save questions
            </button>
            <button type="button" className="pp-link" onClick={() => setPicked(game.questions)}>
              Undo changes
            </button>
            {picked.length < MIN && <span className="pp-soft" style={{ fontSize: "0.88rem" }}>Pick at least {MIN}.</span>}
          </div>
        )}
      </div>

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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {game.closed ? (
            <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => run(() => setTrivia(slug, { closed: false }))}>
              Reopen trivia
            </button>
          ) : (
            <button
              type="button"
              className="pp-btn"
              style={small}
              onClick={() => run(() => setTrivia(slug, { closed: true }), "Close trivia? Nobody else can play, and the top score wins.")}
            >
              Close trivia &amp; pick the winner
            </button>
          )}
          {board.length > 0 && (
            <button
              type="button"
              className="pp-link"
              style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}
              onClick={() => run(() => clearTrivia(slug), "Clear everyone's answers so they can play again?")}
            >
              Start over
            </button>
          )}
        </div>
      </div>
      <GamePrize slug={slug} game="trivia" prize={game.prize} resultsOut={game.closed} winners={winners} canEmail={canEmail} />
      {msg?.message && <p style={{ color: "var(--pp-accent)" }}>{msg.message}</p>}
    </GameCard>
  );
}
