"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveBabyGuesses } from "../actions";

type GamePhoto = { id: string; url: string | null; answer: string | null };
type BoardRow = { name: string; correct: number; total: number; place: number; mine: boolean; key: number };

export function BabyPhotoGame({
  slug,
  revealed,
  photos,
  options,
  myName,
  myGuesses,
  players,
  board,
}: {
  slug: string;
  revealed: boolean;
  photos: GamePhoto[];
  options: string[];
  myName: string;
  myGuesses: Record<string, string>;
  players: number;
  board: BoardRow[];
}) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const [name, setName] = useState(myName);
  const [guesses, setGuesses] = useState<Record<string, string>>(myGuesses);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (myName) return;
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [myName, nameKey]);

  const answered = photos.filter((p) => guesses[p.id]).length;

  async function save() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Please add your name first.");
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    const res = await saveBabyGuesses(slug, { name, guesses });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  if (revealed) {
    return (
      <>
        <section className="pp-paper" style={{ maxWidth: "34rem", margin: "1.75rem auto 0", padding: "1.4rem 1.2rem" }}>
          <h2 className="pp-caps" style={{ fontSize: "0.8rem", marginBottom: "0.8rem" }}>
            Leaderboard
          </h2>
          {board.length === 0 ? (
            <p className="pp-soft">Nobody played this time.</p>
          ) : (
            <table className="pp-board-table">
              <thead>
                <tr>
                  <th style={{ width: "3rem" }}>Place</th>
                  <th>Name</th>
                  <th style={{ textAlign: "right" }}>Correct</th>
                </tr>
              </thead>
              <tbody>
                {board.map((r) => (
                  <tr key={r.key} data-mine={r.mine}>
                    <td>
                      <span className="pp-place" data-top={r.place === 1}>
                        {r.place}
                      </span>
                    </td>
                    <td>
                      {r.name}
                      {r.mine ? " (you)" : ""}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.correct} / {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <ul className="pp-album" aria-label="Answers">
          {photos.map((p, i) => {
            const mine = myGuesses[p.id];
            const right = mine && p.answer && mine.toLowerCase() === p.answer.toLowerCase();
            return (
              <li key={p.id} className="pp-album-item" style={{ transform: `rotate(${[-1.5, 1.2, -0.8, 1.8][i % 4]}deg)` }}>
                <figure className="pp-print">
                  <div className="pp-print-photo" style={{ cursor: "default" }}>
                    {p.url && <img src={p.url} alt={`Baby photo ${i + 1}`} />}
                  </div>
                  <figcaption style={{ paddingRight: 0 }}>
                    <span className="pp-hand pp-print-caption">It&apos;s {p.answer}!</span>
                    {mine && (
                      <span className="pp-print-by" style={{ color: right ? "var(--pp-accent)" : "var(--pp-leather)" }}>
                        {right ? "✓ You got it" : `✗ You guessed ${mine}`}
                      </span>
                    )}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <>
      <section className="pp-paper" style={{ maxWidth: "34rem", margin: "1.75rem auto 0", padding: "1.4rem 1.2rem", display: "grid", gap: "0.6rem" }}>
        <label htmlFor="bp-name" className="pp-caps" style={{ fontSize: "0.72rem" }}>
          Your name
        </label>
        <input id="bp-name" className="pp-field" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="e.g. Aunt Mimi" />
        <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
          {players} {players === 1 ? "person has" : "people have"} played so far.
        </p>
      </section>

      <ul className="pp-album" aria-label="Baby photos">
        {photos.map((p, i) => (
          <li key={p.id} className="pp-album-item" style={{ transform: `rotate(${[-1.5, 1.2, -0.8, 1.8][i % 4]}deg)` }}>
            <figure className="pp-print">
              <div className="pp-print-photo" style={{ cursor: "default" }}>
                {p.url && <img src={p.url} alt={`Baby photo ${i + 1}`} />}
              </div>
              <figcaption style={{ paddingRight: 0 }}>
                <label htmlFor={`g-${p.id}`} className="pp-print-by" style={{ marginBottom: 4 }}>
                  Photo {i + 1} is…
                </label>
                <select
                  id={`g-${p.id}`}
                  className="pp-field"
                  style={{ fontSize: "0.95rem", padding: "0.45rem 0.5rem" }}
                  value={guesses[p.id] ?? ""}
                  onChange={(e) => setGuesses((g) => ({ ...g, [p.id]: e.target.value }))}
                >
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "2rem", display: "grid", justifyItems: "center", gap: "0.6rem", textAlign: "center" }}>
        <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
          {answered} of {photos.length} guessed
        </p>
        <button type="button" className="pp-btn" onClick={save} disabled={busy || answered === 0}>
          {busy ? "Saving…" : Object.keys(myGuesses).length ? "Update my guesses" : "Lock in my guesses"}
        </button>
        {error && (
          <p role="alert" style={{ color: "var(--pp-leather)" }}>
            {error}
          </p>
        )}
        {saved && (
          <p role="status" style={{ color: "var(--pp-accent)" }}>
            Saved! Check back when the host reveals the answers.
          </p>
        )}
      </div>
    </>
  );
}
