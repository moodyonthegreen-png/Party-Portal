"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { saveTrivia } from "../actions";

/** A question as guests see it before playing: no answer, no fact */
export type TriviaAsk = { id: string; q: string; options: string[] };

const LETTERS = ["A", "B", "C", "D", "E"];

export function TriviaGame({ slug, questions }: { slug: string; questions: TriviaAsk[] }) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const [step, setStep] = useState(0); // questions.length = the "sign your name" step
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [nameKey]);

  const total = questions.length;
  const q = questions[step];
  const answered = Object.keys(answers).length;

  function pick(i: number) {
    setAnswers({ ...answers, [q.id]: i });
    // A beat to see the choice, then on to the next one
    setTimeout(() => setStep((s) => Math.min(s + 1, total)), 280);
  }

  async function submit() {
    if (!name.trim()) {
      setError("Please add your name so you show up on the leaderboard.");
      return;
    }
    const missing = questions.findIndex((x) => answers[x.id] === undefined);
    if (missing >= 0) {
      setStep(missing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    const res = await saveTrivia(slug, { name, answers });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="tv-play">
      <div className="tv-progress" aria-hidden="true">
        <div style={{ width: `${(Math.min(step, total) / total) * 100}%` }} />
      </div>

      {q ? (
        <div className="pp-paper tv-q" key={q.id}>
          <p className="pp-caps pp-soft tv-count">
            Question {step + 1} of {total}
          </p>
          <h2 className="tv-ask">{q.q}</h2>
          <div className="tv-options" role="radiogroup" aria-label={q.q}>
            {q.options.map((o, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={answers[q.id] === i}
                className="tv-option"
                data-picked={answers[q.id] === i}
                onClick={() => pick(i)}
              >
                <span className="tv-letter">{LETTERS[i]}</span>
                {o}
              </button>
            ))}
          </div>
          <div className="tv-nav">
            <button type="button" className="pp-link" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(step - 1)}>
              ← Back
            </button>
            {answers[q.id] !== undefined && (
              <button type="button" className="pp-link" onClick={() => setStep(step + 1)}>
                Next →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pp-paper tv-q">
          <p className="pp-caps pp-soft tv-count">All done!</p>
          <h2 className="tv-ask">
            You answered {answered} of {total}. Ready to see your score?
          </h2>
          <label htmlFor="tv-name" className="pp-caps" style={{ fontSize: "0.72rem" }}>
            Your name
          </label>
          <input id="tv-name" className="pp-field" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For the leaderboard" />
          {error && (
            <p role="alert" style={{ color: "var(--pp-leather)" }}>
              {error}
            </p>
          )}
          <div className="tv-nav">
            <button type="button" className="pp-link" onClick={() => setStep(total - 1)}>
              ← Back
            </button>
            <button type="button" className="pp-btn" onClick={submit} disabled={busy}>
              {busy ? "Checking…" : "See my score"}
            </button>
          </div>
          <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
            One try per person, so check your answers before you go.
          </p>
        </div>
      )}
    </div>
  );
}
