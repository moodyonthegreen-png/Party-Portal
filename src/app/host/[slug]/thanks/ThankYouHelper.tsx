"use client";

import { useMemo, useRef, useState } from "react";
import type { ThankRow } from "@/lib/thanks";
import { contributionPhrases, draftThankYou, joinList } from "@/lib/thanks-draft";
import { emailThankYou, getCardLink, setGiftNote, setThanked } from "../actions";

type Filter = "all" | "todo" | "done";

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function ThankYouHelper({
  slug,
  guestOfHonorName,
  signOff,
  people: initial,
  canEmail,
}: {
  slug: string;
  guestOfHonorName: string;
  signOff: string | null;
  people: ThankRow[];
  canEmail: boolean;
}) {
  const [people, setPeople] = useState(initial);
  const [filter, setFilter] = useState<Filter>("todo");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = people.filter((p) => p.thankedAt).length;
  const shown = people.filter((p) => (filter === "all" ? true : filter === "done" ? p.thankedAt : !p.thankedAt));
  const pct = people.length ? Math.round((done / people.length) * 100) : 0;

  const patch = (key: string, change: Partial<ThankRow>) =>
    setPeople((all) => all.map((p) => (p.key === key ? { ...p, ...change } : p)));

  async function toggle(p: ThankRow) {
    const thanked = !p.thankedAt;
    patch(p.key, { thankedAt: thanked ? new Date().toISOString() : null });
    const res = await setThanked(slug, p.key, thanked);
    if (res.error) {
      setError(res.error);
      patch(p.key, { thankedAt: p.thankedAt });
    }
  }

  function downloadCsv() {
    const rows = [
      ["Name", "Email", "Gift", "What they did", "Thanked"],
      ...people.map((p) => [
        p.name,
        p.email ?? "",
        p.giftNote ?? "",
        joinList(contributionPhrases(p.contributions, guestOfHonorName)),
        p.thankedAt ? new Date(p.thankedAt).toLocaleDateString() : "",
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-thank-yous.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!people.length) {
    return (
      <p className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
        Nobody to thank yet. Guests appear here as they&apos;re added to the guest list or take part in the party.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="pp-paper" style={{ padding: "1.25rem", borderRadius: 4, display: "grid", gap: "0.75rem" }}>
        <p>
          <span className="pp-display" style={{ fontSize: "2.2rem", fontWeight: 600 }}>
            {done}
          </span>{" "}
          <span className="pp-soft">of {people.length} thanked</span>
        </p>
        <div style={{ height: 10, borderRadius: 999, background: "var(--pp-accent-soft)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--pp-accent)" }} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {(
            [
              ["todo", `Still to thank (${people.length - done})`],
              ["done", `Thanked (${done})`],
              ["all", `Everyone (${people.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className="pp-caps"
              style={{
                fontSize: "0.68rem",
                padding: "0.45rem 0.8rem",
                borderRadius: 999,
                border: "1px solid var(--pp-paper-edge)",
                background: filter === key ? "var(--pp-accent)" : "#fff",
                color: filter === key ? "var(--pp-paper)" : "var(--pp-ink-soft)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
          <button type="button" className="pp-link" style={{ marginLeft: "auto", fontSize: "0.9rem" }} onClick={downloadCsv}>
            Download list (spreadsheet)
          </button>
        </div>
        {error && <p style={{ color: "var(--pp-leather)" }}>{error}</p>}
      </section>

      {shown.length === 0 ? (
        <p className="pp-soft" style={{ textAlign: "center" }}>
          {filter === "todo" ? "Everyone's been thanked. Lovely work!" : "Nobody here yet."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {shown.map((p) => (
            <PersonCard
              key={p.key}
              slug={slug}
              person={p}
              guestOfHonorName={guestOfHonorName}
              signOff={signOff}
              canEmail={canEmail}
              open={open === p.key}
              onToggleOpen={() => setOpen(open === p.key ? null : p.key)}
              onToggleThanked={() => toggle(p)}
              onChange={(change) => patch(p.key, change)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonCard({
  slug,
  person: p,
  guestOfHonorName,
  signOff,
  canEmail,
  open,
  onToggleOpen,
  onToggleThanked,
  onChange,
}: {
  slug: string;
  person: ThankRow;
  guestOfHonorName: string;
  signOff: string | null;
  canEmail: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleThanked: () => void;
  onChange: (change: Partial<ThankRow>) => void;
}) {
  const [gift, setGift] = useState(p.giftNote ?? "");
  const [savedGift, setSavedGift] = useState(p.giftNote ?? "");
  const draft = useMemo(
    () => draftThankYou({ name: p.name, guestOfHonorName, contributions: p.contributions, gift, signOff }),
    [p.name, guestOfHonorName, p.contributions, gift, signOff],
  );
  const [message, setMessage] = useState<string | null>(null); // null = follow the draft
  const [email, setEmail] = useState(p.email ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const giftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = message ?? draft;

  const did = contributionPhrases(p.contributions, guestOfHonorName);
  const badges = [
    p.contributions.design && "🎨 Design",
    p.contributions.note === "text" && "📖 Note",
    p.contributions.note === "audio" && "🎙 Voice memo",
    p.contributions.note === "video" && "🎥 Video",
    p.contributions.photos > 0 && `📷 ${p.contributions.photos} ${p.contributions.photos === 1 ? "photo" : "photos"}`,
    p.contributions.games && "🎲 Games",
  ].filter(Boolean) as string[];

  function saveGift(value: string) {
    setGift(value);
    if (giftTimer.current) clearTimeout(giftTimer.current);
    giftTimer.current = setTimeout(async () => {
      if (value.trim() === savedGift.trim()) return;
      const res = await setGiftNote(slug, p.key, value);
      if (!res.error) {
        setSavedGift(value);
        onChange({ giftNote: value.trim() || null });
      }
    }, 700);
  }

  async function send() {
    if (!window.confirm(`Email this thank-you to ${email}?`)) return;
    setBusy(true);
    setStatus(null);
    const res = await emailThankYou(slug, p.key, p.name, email, text);
    setBusy(false);
    if (res.error) setStatus(res.error);
    else {
      const now = new Date().toISOString();
      onChange({ emailedAt: now, thankedAt: now, email, hasCard: true });
      setStatus("Card sent! Marked as thanked.");
    }
  }

  /** Save the card, then copy its link or open a preview. */
  async function cardLink(then: "copy" | "preview") {
    // Open the tab straight away so pop-up blockers allow it
    const tab = then === "preview" ? window.open("", "_blank") : null;
    setBusy(true);
    setStatus(null);
    const res = await getCardLink(slug, p.key, p.name, text);
    setBusy(false);
    if (res.error || !res.url) {
      tab?.close();
      setStatus(res.error ?? "Something went wrong.");
      return;
    }
    onChange({ hasCard: true });
    if (then === "preview") {
      if (tab) tab.location.href = `${res.url}?preview=1`;
      else window.open(`${res.url}?preview=1`, "_blank");
    } else {
      await navigator.clipboard.writeText(res.url);
      setStatus("Card link copied. Paste it into a text message!");
    }
  }

  return (
    <li className="pp-paper" style={{ padding: "1rem 1.1rem", borderRadius: 4, opacity: p.thankedAt && !open ? 0.75 : 1 }}>
      <div style={{ display: "flex", gap: "0.85rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={Boolean(p.thankedAt)}
          onChange={onToggleThanked}
          aria-label={`Thanked ${p.name}`}
          style={{ width: 22, height: 22, accentColor: "var(--pp-accent)", flexShrink: 0 }}
        />
        <div className="checker" style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", flexShrink: 0, border: "1px solid var(--pp-paper-edge)", display: "grid", placeItems: "center" }}>
          {p.designUrl ? (
            <img src={p.designUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          ) : (
            <span className="pp-script" style={{ fontSize: "1.4rem", color: "var(--pp-accent)" }}>
              {p.name.charAt(0)}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, textDecoration: p.thankedAt ? "line-through" : "none" }}>{p.name}</p>
          <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
            {badges.length ? badges.join(" · ") : p.onGuestList ? "On the guest list" : ""}
            {p.giftNote ? ` · 🎁 ${p.giftNote}` : ""}
            {p.cardOpenedAt ? " · 💌 card opened" : p.emailedAt ? " · ✉️ card sent" : ""}
          </p>
        </div>
        <button type="button" className="pp-link" style={{ fontSize: "0.9rem", flexShrink: 0 }} onClick={onToggleOpen}>
          {open ? "Close" : "Write note"}
        </button>
      </div>

      {open && (
        <div style={{ display: "grid", gap: "0.8rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--pp-paper-edge)" }}>
          {did.length > 0 && (
            <p style={{ fontSize: "0.95rem" }}>
              <span className="pp-soft">They gave you </span>
              {joinList(did)}.
            </p>
          )}
          {p.noteText && (
            <blockquote className="pp-hand" style={{ margin: 0, padding: "0.6rem 0.9rem", borderLeft: "3px solid var(--pp-gold)", background: "#fffdf8", fontSize: "1.2rem", whiteSpace: "pre-line" }}>
              {p.noteText.length > 280 ? `${p.noteText.slice(0, 280)}…` : p.noteText}
            </blockquote>
          )}
          <div>
            <label htmlFor={`gift-${p.key}`} className="pp-caps" style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}>
              Gift they gave
            </label>
            <input
              id={`gift-${p.key}`}
              className="pp-field"
              value={gift}
              maxLength={300}
              placeholder="e.g. a stack of board books"
              onChange={(e) => saveGift(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`msg-${p.key}`} className="pp-caps" style={{ fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" }}>
              Thank-you note {message === null ? "(drafted for you, edit as you like)" : ""}
            </label>
            <textarea
              id={`msg-${p.key}`}
              className="pp-field"
              rows={8}
              value={text}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
            {message !== null && (
              <button type="button" className="pp-link" style={{ fontSize: "0.85rem" }} onClick={() => setMessage(null)}>
                Start over from the draft
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <p className="pp-caps" style={{ fontSize: "0.7rem" }}>
              Send it as a card that opens 💌
            </p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
              {canEmail && (
                <>
                  <input
                    type="email"
                    className="pp-field"
                    value={email}
                    placeholder="their email"
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "auto", minWidth: 200, padding: "0.55rem 0.75rem", fontSize: "0.95rem" }}
                    aria-label="Their email"
                  />
                  <button
                    type="button"
                    className="pp-btn"
                    style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }}
                    disabled={busy || !email.includes("@")}
                    onClick={send}
                  >
                    {busy ? "Working…" : p.emailedAt ? "Email the card again" : "Email the card"}
                  </button>
                </>
              )}
              <button type="button" className="pp-btn pp-btn-ghost" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={busy} onClick={() => cardLink("copy")}>
                Copy card link
              </button>
              <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} disabled={busy} onClick={() => cardLink("preview")}>
                Preview card
              </button>
            </div>
            <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
              Writing a paper card instead?{" "}
              <button
                type="button"
                className="pp-link"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setStatus("Note copied.");
                }}
              >
                Copy just the note
              </button>
            </p>
          </div>
          {status && <p style={{ fontSize: "0.9rem", color: /^(Card|Note|Sent)/.test(status) ? "var(--pp-accent)" : "var(--pp-leather)" }}>{status}</p>}
        </div>
      )}
    </li>
  );
}
