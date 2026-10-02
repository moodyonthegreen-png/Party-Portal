"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveAnimals } from "../actions";

export type AnimalAsk = { id: string; animal: string };

export function AnimalGame({ slug, questions }: { slug: string; questions: AnimalAsk[] }) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const total = questions.length;
  const [step, setStep] = useState(0); // total = the "sign your name" step
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [nameKey]);

  // Keep the keyboard up from one animal to the next
  useEffect(() => {
    if (step > 0) input.current?.focus();
  }, [step]);

  const q = questions[step];
  const filled = questions.filter((x) => (answers[x.id] ?? "").trim()).length;

  async function submit() {
    if (!name.trim()) {
      setError("Please add your name so you show up on the leaderboard.");
      return;
    }
    if (!filled) {
      setError("Take a guess at one or more first!");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    const res = await saveAnimals(slug, { name, answers });
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
        <form
          className="pp-paper tv-q"
          key={q.id}
          onSubmit={(e) => {
            e.preventDefault();
            setStep(step + 1);
          }}
        >
          <p className="pp-caps pp-soft tv-count">
            {step + 1} of {total}
          </p>
          <p className="an-ask">
            A baby <span className="an-animal">{q.animal}</span> is called a…
          </p>
          <input
            ref={input}
            className="pp-field an-input"
            aria-label={`What's a baby ${q.animal} called?`}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={step + 1 < total ? "next" : "done"}
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            placeholder="Type your guess"
          />
          <div className="tv-nav">
            <button type="button" className="pp-link" style={{ visibility: step === 0 ? "hidden" : "visible" }} onClick={() => setStep(step - 1)}>
              ← Back
            </button>
            <button type="submit" className={(answers[q.id] ?? "").trim() ? "pp-btn" : "pp-btn pp-btn-ghost"} style={{ minWidth: "7rem" }}>
              {(answers[q.id] ?? "").trim() ? "Next →" : "Skip →"}
            </button>
          </div>
        </form>
      ) : (
        <div className="pp-paper tv-q">
          <p className="pp-caps pp-soft tv-count">All done!</p>
          <h2 className="tv-ask">
            You guessed {filled} of {total}. Ready to see how you did?
          </h2>
          <label htmlFor="an-name" className="pp-caps" style={{ fontSize: "0.72rem" }}>
            Your name
          </label>
          <input id="an-name" className="pp-field" maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="For the leaderboard" />
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
            One try per person. Spelling doesn&apos;t have to be perfect.
          </p>
        </div>
      )}
    </div>
  );
}
