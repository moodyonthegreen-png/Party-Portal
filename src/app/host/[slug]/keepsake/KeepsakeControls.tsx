"use client";

import { useState, useTransition } from "react";
import { revealPreviewLink, saveRevealSettings, sendRevealNow, type ActionState } from "../actions";

const small: React.CSSProperties = { fontSize: "0.8rem", padding: "0.7rem 1rem" };

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function KeepsakeControls({
  slug,
  firstName,
  initialEmail,
  auto: initialAuto,
  sentAt,
  openedAt,
  canEmail,
  closesLabel,
  isOpen,
}: {
  slug: string;
  firstName: string;
  initialEmail: string;
  auto: boolean;
  sentAt: string | null;
  openedAt: string | null;
  canEmail: boolean;
  closesLabel: React.ReactNode;
  isOpen: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [auto, setAuto] = useState(initialAuto);
  const [state, setState] = useState<ActionState | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ActionState>) => {
    setState(null);
    start(async () => setState(await fn()));
  };

  return (
    <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", display: "grid", gap: "1rem", opacity: pending ? 0.7 : 1 }}>
      <h3 className="pp-caps" style={{ fontSize: "0.8rem" }}>
        Send it to {firstName}
      </h3>

      {(sentAt || openedAt) && (
        <p className="pp-note" style={{ fontSize: "0.95rem" }}>
          {sentAt ? `Sent ${shortDate(sentAt)}` : ""}
          {openedAt ? `${sentAt ? " · " : ""}${firstName} opened it ${shortDate(openedAt)}` : sentAt ? " · not opened yet" : ""}
        </p>
      )}

      <div>
        <label htmlFor="rv-email" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
          {firstName}&apos;s email
        </label>
        <input id="rv-email" type="email" className="pp-field" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
      </div>

      {canEmail && (
        <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            disabled={Boolean(sentAt)}
            style={{ width: 18, height: 18, marginTop: 3, accentColor: "var(--pp-accent)" }}
          />
          <span>
            Send it automatically the morning after the party closes ({closesLabel})
            {sentAt && <span className="pp-soft"> (already sent)</span>}
          </span>
        </label>
      )}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="pp-btn pp-btn-ghost"
          style={small}
          disabled={pending || (email === initialEmail && auto === initialAuto)}
          onClick={() => run(() => saveRevealSettings(slug, { email, auto }))}
        >
          Save
        </button>
        <button
          type="button"
          className="pp-btn pp-btn-ghost"
          style={small}
          disabled={pending}
          onClick={() =>
            start(async () => {
              // Open the tab right away so pop-up blockers allow it
              const tab = window.open("about:blank", "_blank");
              const res = await revealPreviewLink(slug);
              if (res.url && tab) tab.location.href = res.url;
              else {
                tab?.close();
                setState(res);
              }
            })
          }
        >
          Preview
        </button>
        {canEmail && (
          <button
            type="button"
            className="pp-btn"
            style={small}
            disabled={pending || !email.trim()}
            onClick={() => {
              const warn = isOpen
                ? `The party is still open, so guests can keep adding things. That's okay, ${firstName}'s keepsake always shows the latest. Send it now?`
                : `Send ${firstName} her keepsake now?`;
              if (!window.confirm(sentAt ? `Send it to ${email} again?` : warn)) return;
              run(() => sendRevealNow(slug, email));
            }}
          >
            {sentAt ? "Send again" : "Send it now"}
          </button>
        )}
      </div>
      {!canEmail && (
        <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
          Email isn&apos;t set up yet, so use Preview and share that page&apos;s link with {firstName} (without the
          &quot;?preview=1&quot; on the end).
        </p>
      )}

      {state?.error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {state.error}
        </p>
      )}
      {state?.message && <p style={{ color: "var(--pp-accent)" }}>{state.message}</p>}
    </section>
  );
}
