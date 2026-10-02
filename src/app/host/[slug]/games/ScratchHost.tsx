"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ScratchSettings } from "@/lib/games/settings";
import { resizeToJpeg } from "@/lib/image/resize";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { finishScratchPhoto, giveScratchToNext, resetScratch, setScratchGame, startScratchPhoto, type ActionState } from "../actions";
import { GamePrize } from "./GamePrize";

type Winner = { key: string; name: string; emailedAt: string | null; email: string | null };

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", display: "grid", gap: "1rem" };
const small: React.CSSProperties = { fontSize: "0.85rem", padding: "0.6rem 1rem" };
const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };

export function ScratchHost({
  slug,
  game,
  ready,
  photoUrl,
  cards,
  winningCard,
  winners,
  canEmail,
  guestListSize,
}: {
  slug: string;
  game: ScratchSettings;
  ready: boolean;
  photoUrl: string | null;
  cards: { cardNo: number; name: string; winner: boolean }[];
  winningCard: number | null;
  winners: Winner[];
  canEmail: boolean;
  guestListSize: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState | null>(null);
  const [expected, setExpected] = useState(String(game.expected));
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const person = game.who === "mommy" ? "mommy" : "daddy";
  const found = cards.find((c) => c.winner) ?? null;

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.error || res.message ? res : null);
      router.refresh();
    });
  };

  async function upload(f: File) {
    setUploading(true);
    setMsg(null);
    try {
      const img = await resizeToJpeg(f, 1400).catch(() => {
        throw new Error("That photo couldn't be opened here. Try a JPEG or PNG.");
      });
      const res = await startScratchPhoto(slug);
      if (!res.ok) throw new Error(res.error);
      const { error } = await supabaseBrowser().storage.from("photos").uploadToSignedUrl(res.path, res.token, img.blob, { contentType: "image/jpeg" });
      if (error) throw new Error("The photo didn't finish uploading. Check your connection.");
      const fin = await finishScratchPhoto(slug, res.path);
      if (fin.error) throw new Error(fin.error);
      router.refresh();
    } catch (e) {
      setMsg({ error: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="pp-paper" style={{ ...card, opacity: pending ? 0.7 : 1, transition: "opacity .2s" }} id="scratch">
      <div>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Who has the {person}? (scratch-off)
        </h2>
        <p className="pp-soft" style={{ fontSize: "0.95rem", marginTop: "0.35rem" }}>
          Every guest scratches one card. One secret card shows a photo of the {person}-to-be; every other card shows it blurred
          with &ldquo;Not this time!&rdquo;
        </p>
      </div>

      {!ready ? (
        <p className="pp-note">This game isn&apos;t switched on yet. Moody Celebrations needs to run one quick database update first.</p>
      ) : (
        <>
          <label style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={game.on}
              onChange={(e) => run(() => setScratchGame(slug, { on: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }}
            />
            Show this game to guests
          </label>

          <fieldset className="sc-who">
            <legend className="pp-caps" style={label}>
              The game
            </legend>
            {(["daddy", "mommy"] as const).map((w) => (
              <label key={w}>
                <input type="radio" name="sc-who" checked={game.who === w} onChange={() => run(() => setScratchGame(slug, { who: w }))} />
                Who has the {w}?
              </label>
            ))}
          </fieldset>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="sc-host-photo" onClick={() => file.current?.click()} disabled={uploading}>
              {photoUrl ? <img src={photoUrl} alt={`The ${person}`} /> : <span className="pp-soft">{uploading ? "Uploading…" : "Add photo"}</span>}
            </button>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontWeight: 600 }}>Photo of the {person}</p>
              <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
                A clear, fun photo of their face works best. The game shows to guests once there&apos;s a photo.
              </p>
              <button type="button" className="pp-link" style={{ marginTop: "0.35rem" }} onClick={() => file.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : photoUrl ? "Choose a different photo" : "Choose a photo"}
              </button>
            </div>
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
          </div>

          <div>
            <label htmlFor="sc-expected" className="pp-caps" style={label}>
              About how many guests will play?
            </label>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <input
                id="sc-expected"
                className="pp-field"
                style={{ width: "7rem" }}
                type="number"
                inputMode="numeric"
                min={1}
                max={300}
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
              <button
                type="button"
                className="pp-btn pp-btn-ghost"
                style={small}
                disabled={Number(expected) === game.expected || Boolean(found)}
                onClick={() => run(() => setScratchGame(slug, { expected: Number(expected) }))}
              >
                Save
              </button>
            </div>
            <p className="pp-soft" style={{ fontSize: "0.88rem", marginTop: "0.3rem" }}>
              The winning card is secretly picked from card 1 up to this number, so aim a little under your guest
              count to make sure someone finds it.
              {guestListSize > 0 ? ` You have ${guestListSize} on your guest list.` : ""}
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.75rem" }}>
            <p>
              <strong>{cards.length}</strong> {cards.length === 1 ? "card" : "cards"} scratched.{" "}
              {found ? (
                <>
                  <strong>{found.name}</strong> has the {person} (card No. {found.cardNo})!
                </>
              ) : (
                "Nobody has the winning card yet."
              )}
            </p>
            {cards.length > 0 && (
              <ol className="sc-host-list">
                {cards.map((c) => (
                  <li key={c.cardNo} data-winner={c.winner}>
                    <span>No. {c.cardNo}</span> {c.name}
                    {c.winner ? " ★" : ""}
                  </li>
                ))}
              </ol>
            )}
            {!found && (
              <>
                <details>
                  <summary className="pp-link" style={{ display: "inline", cursor: "pointer" }}>
                    Peek at the winning card number
                  </summary>
                  <p style={{ marginTop: "0.4rem" }}>
                    {winningCard ? `Card No. ${winningCard}.` : "It's picked when you turn the game on."}{" "}
                    {winningCard && winningCard > cards.length + 1 ? `${winningCard - cards.length - 1} more cards to go before it.` : ""}
                  </p>
                </details>
                <div>
                  <button
                    type="button"
                    className="pp-btn pp-btn-ghost"
                    style={small}
                    onClick={() => run(() => giveScratchToNext(slug), "Make the very next card scratched the winner? Handy near the end of the party if nobody's found it yet.")}
                  >
                    Make the next card the winner
                  </button>
                </div>
              </>
            )}
            {cards.length > 0 && (
              <div>
                <button
                  type="button"
                  className="pp-link"
                  style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}
                  onClick={() => run(() => resetScratch(slug), "Start over? Every card is cleared, guests can play again, and a new winning card is picked.")}
                >
                  Start over
                </button>
              </div>
            )}
          </div>
          <GamePrize slug={slug} game="scratch" prize={game.prize} resultsOut={Boolean(found)} winners={winners} canEmail={canEmail} />
        </>
      )}

      {msg?.error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {msg.error}
        </p>
      )}
      {msg?.message && <p style={{ color: "var(--pp-accent)" }}>{msg.message}</p>}
    </section>
  );
}
