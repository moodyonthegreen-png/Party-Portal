"use client";

import { useRef, useState, useTransition } from "react";
import type { BabyPhoto } from "@/lib/games";
import type { GameSettings } from "@/lib/games/settings";
import { resizeToJpeg } from "@/lib/image/resize";
import { GamePrize } from "./GamePrize";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  deleteBabyPhoto,
  finishBabyPhoto,
  setBabyPhotoGame,
  setPoolGame,
  setPoolResults,
  startBabyPhoto,
  type ActionState,
} from "../actions";

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", display: "grid", gap: "1rem" };
const small: React.CSSProperties = { fontSize: "0.8rem", padding: "0.65rem 1rem" };
const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }} />
      {children}
    </label>
  );
}

export function HostGames({
  slug,
  games,
  photos,
  babyBoard,
  poolCount,
  winners,
  canEmail,
}: {
  slug: string;
  games: GameSettings;
  photos: BabyPhoto[];
  babyBoard: { name: string; correct: number; total: number; place: number }[];
  poolCount: number;
  winners: Record<"babyPhotos" | "pool", { key: string; name: string; emailedAt: string | null; email: string | null }[]>;
  canEmail: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  // Adding baby photos
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [adding, setAdding] = useState(false);

  async function addPhoto() {
    if (!file || !answer.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const resized = await resizeToJpeg(file, 1400).catch(() => {
        throw new Error("That photo couldn't be opened here. Try a JPEG.");
      });
      const res = await startBabyPhoto(slug, answer);
      if (!res.ok) throw new Error(res.error);
      const { error: upErr } = await supabaseBrowser()
        .storage.from("photos")
        .uploadToSignedUrl(res.path, res.token, resized.blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error("Upload didn't finish. Check your connection.");
      const fin = await finishBabyPhoto(slug, res.id, answer);
      if (fin.error) throw new Error(fin.error);
      setFile(null);
      setPreview(null);
      setAnswer("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  // Pool results
  const actual = games.pool.actual;
  const [date, setDate] = useState(actual?.date ?? "");
  const [time, setTime] = useState(actual?.time ?? "");
  const [lb, setLb] = useState(String(actual ? Math.floor(actual.weightOz / 16) : 7));
  const [oz, setOz] = useState(String(actual ? actual.weightOz % 16 : 8));
  const [len, setLen] = useState(actual?.lengthIn != null ? String(actual.lengthIn) : "");

  return (
    <div style={{ display: "grid", gap: "1.75rem", opacity: pending ? 0.7 : 1, transition: "opacity .2s" }}>
      {error && (
        <p role="alert" className="pp-note" style={{ color: "var(--pp-leather)" }}>
          {error}
        </p>
      )}

      {/* Guess the baby photo */}
      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Guess the baby photo
        </h2>
        <Toggle on={games.babyPhotos.on} onChange={(v) => run(() => setBabyPhotoGame(slug, { on: v }))}>
          Show this game to guests
        </Toggle>
        <p className="pp-soft" style={{ fontSize: "0.95rem" }}>
          Add baby photos of family and friends, and who each one is. Guests pick names from the list of answers you add. The game
          appears once there&apos;s at least one photo.
        </p>

        <div style={{ display: "grid", gap: "0.6rem", padding: "1rem", border: "1px dashed var(--pp-paper-edge)", borderRadius: 10 }}>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => fileInput.current?.click()} style={{ width: 84, height: 84, border: "1px solid var(--pp-paper-edge)", borderRadius: 8, background: "#fff", overflow: "hidden", cursor: "pointer", padding: 0 }}>
              {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="pp-soft" style={{ fontSize: "0.8rem" }}>Choose photo</span>}
            </button>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="bp-answer" className="pp-caps" style={label}>
                Who is this?
              </label>
              <input id="bp-answer" className="pp-field" maxLength={80} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="e.g. Grandpa Joe" />
            </div>
          </div>
          <div>
            <button type="button" className="pp-btn" style={small} disabled={!file || !answer.trim() || adding} onClick={addPhoto}>
              {adding ? "Adding…" : "Add photo"}
            </button>
          </div>
        </div>

        {photos.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "0.9rem" }}>
            {photos.map((p, i) => (
              <li key={p.id}>
                <div style={{ aspectRatio: "1", borderRadius: 6, overflow: "hidden", background: "#eee" }}>
                  {p.url && <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <p style={{ fontSize: "0.9rem", marginTop: 4 }}>
                  {i + 1}. {p.answer}
                </p>
                <button type="button" className="pp-link" style={{ fontSize: "0.8rem", color: "var(--pp-leather)" }} onClick={() => run(() => deleteBabyPhoto(slug, p.id), "Remove this photo from the game?")}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.75rem" }}>
          <p>
            <strong>{babyBoard.length}</strong> {babyBoard.length === 1 ? "guest has" : "guests have"} played.
            {games.babyPhotos.revealed ? " Answers are showing to guests." : " Only you can see the scores until you reveal."}
          </p>
          {babyBoard.length > 0 && (
            <table className="pp-board-table">
              <tbody>
                {babyBoard.slice(0, 10).map((r, i) => (
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
          <div>
            {games.babyPhotos.revealed ? (
              <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => run(() => setBabyPhotoGame(slug, { revealed: false }))}>
                Hide answers and reopen guessing
              </button>
            ) : (
              <button
                type="button"
                className="pp-btn"
                style={small}
                disabled={!photos.length}
                onClick={() => run(() => setBabyPhotoGame(slug, { revealed: true }), "Reveal the answers? Guessing will close and everyone will see the leaderboard.")}
              >
                Reveal answers &amp; leaderboard
              </button>
            )}
          </div>
        </div>
        <GamePrize slug={slug} game="babyPhotos" prize={games.babyPhotos.prize} resultsOut={games.babyPhotos.revealed} winners={winners.babyPhotos} canEmail={canEmail} />
      </section>

      {/* Due date pool */}
      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Due date &amp; weight pool
        </h2>
        <Toggle on={games.pool.on} onChange={(v) => run(() => setPoolGame(slug, { on: v }))}>
          Show this game to guests
        </Toggle>
        <Toggle on={games.pool.closed} onChange={(v) => run(() => setPoolGame(slug, { closed: v }))}>
          Close guessing
        </Toggle>
        <p>
          <strong>{poolCount}</strong> {poolCount === 1 ? "guess" : "guesses"} so far.
        </p>

        <div style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.8rem" }}>
          <p className="pp-caps" style={{ fontSize: "0.72rem" }}>
            Baby is here! Post the results
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.75rem" }}>
            <div>
              <label htmlFor="act-date" className="pp-caps" style={label}>
                Birthday
              </label>
              <input id="act-date" type="date" className="pp-field" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="act-time" className="pp-caps" style={label}>
                Time
              </label>
              <input id="act-time" type="time" className="pp-field" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
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
            <input aria-label="Length in inches" className="pp-field" style={{ width: "8rem" }} inputMode="decimal" placeholder="Length (in)" value={len} onChange={(e) => setLen(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="pp-btn"
              style={small}
              disabled={!date}
              onClick={() => run(() => setPoolResults(slug, { date, time, weightLb: Number(lb), weightOz: Number(oz), lengthIn: len }))}
            >
              {actual ? "Update results" : "Post results"}
            </button>
            {actual && (
              <button type="button" className="pp-btn pp-btn-ghost" style={small} onClick={() => run(() => setPoolResults(slug, null), "Take the results down?")}>
                Take results down
              </button>
            )}
          </div>
          <p className="pp-soft" style={{ fontSize: "0.88rem" }}>
            Posting results closes guessing and shows guests the winners: closest birthday, closest weight, closest length, and an
            overall leaderboard.
          </p>
        </div>
        <GamePrize slug={slug} game="pool" prize={games.pool.prize} resultsOut={Boolean(games.pool.actual)} winners={winners.pool} canEmail={canEmail} />
      </section>
    </div>
  );
}
