"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { savePoolEntry } from "../actions";

type Initial = { name: string; date: string; time: string; weightLb: number; weightOz: number; lengthIn: string };

const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };

export function PoolForm({ slug, initial }: { slug: string; initial: Initial | null }) {
  const router = useRouter();
  const nameKey = `pp_name_${slug}`;
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [lb, setLb] = useState(String(initial?.weightLb ?? 7));
  const [oz, setOz] = useState(String(initial?.weightOz ?? 8));
  const [lengthIn, setLengthIn] = useState(initial?.lengthIn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initial?.name) return;
    try {
      setName(localStorage.getItem(nameKey) ?? "");
    } catch {
      /* storage blocked */
    }
  }, [initial?.name, nameKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      localStorage.setItem(nameKey, name.trim());
    } catch {
      /* ignore */
    }
    const res = await savePoolEntry(slug, {
      name,
      date,
      time,
      weightLb: Number(lb),
      weightOz: Number(oz),
      lengthIn,
    });
    setBusy(false);
    if (!res.ok) setError(res.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="pp-paper"
      style={{ marginTop: "1.75rem", padding: "1.5rem 1.2rem", display: "grid", gap: "1rem", transform: "rotate(-0.5deg)" }}
    >
      <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(2deg)" }} />
      <div>
        <label htmlFor="pool-name" className="pp-caps" style={label}>
          Your name
        </label>
        <input id="pool-name" className="pp-field" value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="pool-date" className="pp-caps" style={label}>
            Birthday
          </label>
          <input id="pool-date" type="date" className="pp-field" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pool-time" className="pp-caps" style={label}>
            Time <span className="pp-soft">(optional)</span>
          </label>
          <input id="pool-time" type="time" className="pp-field" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div>
        <span className="pp-caps" style={label}>
          Weight
        </span>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <select aria-label="Pounds" className="pp-field" style={{ width: "auto" }} value={lb} onChange={(e) => setLb(e.target.value)}>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} lb
              </option>
            ))}
          </select>
          <select aria-label="Ounces" className="pp-field" style={{ width: "auto" }} value={oz} onChange={(e) => setOz(e.target.value)}>
            {Array.from({ length: 16 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                {n} oz
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="pool-length" className="pp-caps" style={label}>
          Length in inches <span className="pp-soft">(optional)</span>
        </label>
        <input
          id="pool-length"
          className="pp-field"
          inputMode="decimal"
          placeholder="e.g. 20.5"
          value={lengthIn}
          onChange={(e) => setLengthIn(e.target.value)}
          style={{ maxWidth: "10rem" }}
        />
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button className="pp-btn" disabled={busy}>
          {busy ? "Saving…" : initial ? "Update my guess" : "Enter the pool"}
        </button>
        {saved && (
          <span role="status" style={{ color: "var(--pp-accent)" }}>
            You&apos;re in! Good luck.
          </span>
        )}
      </div>
    </form>
  );
}
