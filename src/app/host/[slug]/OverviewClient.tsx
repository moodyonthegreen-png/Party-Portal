"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { addGuests, deleteDesign, removeGuest, sendReminders, setDesignHidden, type ActionState } from "./actions";

export type GuestRow = {
  id: string;
  name: string;
  addedBy: "host" | "guest";
  email: string | null;
  remindedAt: string | null;
  design: { url: string | null; hidden: boolean; updatedAt: string } | null;
};

export function CopyButton({ text, label, ghost = false }: { text: string; label: string; ghost?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={ghost ? "pp-btn pp-btn-ghost" : "pp-btn"}
      style={{ fontSize: "0.8rem", padding: "0.7rem 1rem" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Older browsers: fall back to a prompt the host can copy from
          window.prompt("Copy this:", text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export function AddGuestsForm({ slug, withEmails = false }: { slug: string; withEmails?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addGuests.bind(null, slug), {});
  const [value, setValue] = useState("");

  // Clear the box once names are saved (but keep it if something went wrong)
  useEffect(() => {
    if (state.ok) setValue("");
  }, [state]);

  return (
    <form
      action={action}
      style={{ marginTop: "1rem", display: "grid", gap: "0.6rem" }}
    >
      <label htmlFor="names" className="pp-caps" style={{ fontSize: "0.72rem" }}>
        Add guests (one per line)
      </label>
      {withEmails && (
        <p className="pp-soft" style={{ fontSize: "0.88rem", marginTop: "-0.3rem" }}>
          Add an email after a name to send reminders, like &quot;Aunt Mimi, mimi@example.com&quot;. Adding a name that&apos;s
          already listed with an email just saves the email.
        </p>
      )}
      <textarea
        id="names"
        name="names"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={withEmails ? "Aunt Mimi, mimi@example.com\nGrandpa Joe" : "Aunt Mimi\nGrandpa Joe"}
        className="pp-field"
        style={{ resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="pp-btn" disabled={pending || !value.trim()} style={{ fontSize: "0.8rem", padding: "0.7rem 1rem" }}>
          {pending ? "Adding…" : "Add to list"}
        </button>
        {state.error && <span style={{ color: "var(--pp-leather)", fontSize: "0.95rem" }}>{state.error}</span>}
        {state.message && <span className="pp-soft" style={{ fontSize: "0.95rem" }}>{state.message}</span>}
      </div>
    </form>
  );
}

export function GuestList({ slug, guests }: { slug: string; guests: GuestRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "added">("all");

  const run = (fn: () => Promise<ActionState>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  const shown = guests.filter((g) => (filter === "all" ? true : filter === "added" ? g.design : !g.design));
  const waiting = guests.filter((g) => !g.design).length;

  if (!guests.length) {
    return (
      <p className="pp-soft" style={{ marginTop: "1.25rem", fontSize: "1rem" }}>
        No guests yet. Add names above, or they&apos;ll appear here as guests add their designs.
      </p>
    );
  }

  return (
    <div style={{ marginTop: "1.5rem", opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
      <div role="tablist" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {(
          [
            ["all", `Everyone (${guests.length})`],
            ["waiting", `Still to add (${waiting})`],
            ["added", `Added (${guests.length - waiting})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
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
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)", marginTop: "0.75rem" }}>
          {error}
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
        {shown.map((g) => (
          <li
            key={g.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              padding: "0.7rem 0",
              borderTop: "1px solid var(--pp-paper-edge)",
            }}
          >
            <div
              className="checker"
              style={{
                width: 52,
                height: 52,
                flexShrink: 0,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--pp-paper-edge)",
                display: "grid",
                placeItems: "center",
                opacity: g.design?.hidden ? 0.35 : 1,
              }}
            >
              {g.design?.url ? (
                <a href={g.design.url} target="_blank" rel="noopener noreferrer" title="Open full size">
                  <img src={g.design.url} alt={`${g.name}'s design`} style={{ width: 52, height: 52, objectFit: "contain" }} />
                </a>
              ) : (
                <span className="pp-soft" style={{ fontSize: "1.3rem" }} aria-hidden="true">
                  ·
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</p>
              <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
                {g.design ? (g.design.hidden ? "Design hidden" : "Design added ✓") : "Hasn't added a design yet"}
                {g.addedBy === "guest" ? " · added themselves" : ""}
                {g.email ? ` · ${g.email}` : ""}
                {g.remindedAt && !g.design ? ` · reminded ${new Date(g.remindedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
              </p>
            </div>
            <details style={{ position: "relative" }}>
              <summary className="pp-link" style={{ listStyle: "none", fontSize: "0.9rem" }}>
                Options
              </summary>
              <div
                className="pp-paper"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "1.8rem",
                  zIndex: 5,
                  minWidth: 190,
                  padding: "0.4rem",
                  borderRadius: 10,
                  display: "grid",
                }}
              >
                {g.design && (
                  <MenuButton onClick={() => run(() => setDesignHidden(slug, g.id, !g.design!.hidden))}>
                    {g.design.hidden ? "Show design again" : "Hide design"}
                  </MenuButton>
                )}
                {g.design && (
                  <MenuButton
                    onClick={() =>
                      run(() => deleteDesign(slug, g.id), `Delete ${g.name}'s design? They can add a new one before the deadline.`)
                    }
                  >
                    Delete design
                  </MenuButton>
                )}
                <MenuButton
                  danger
                  onClick={() =>
                    run(
                      () => removeGuest(slug, g.id),
                      `Remove ${g.name} from the guest list?${g.design ? " Their design will be deleted too." : ""}`,
                    )
                  }
                >
                  Remove guest
                </MenuButton>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MenuButton({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        onClick();
      }}
      style={{
        textAlign: "left",
        padding: "0.55rem 0.7rem",
        borderRadius: 8,
        border: 0,
        background: "transparent",
        font: "inherit",
        fontSize: "0.95rem",
        color: danger ? "var(--pp-leather)" : "var(--pp-ink)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function ReminderButton({ slug, count, missingEmails }: { slug: string; count: number; missingEmails: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState | null>(null);

  return (
    <div>
      <button
        type="button"
        className="pp-btn"
        style={{ fontSize: "0.8rem", padding: "0.7rem 1rem" }}
        disabled={pending || count === 0}
        onClick={() => {
          if (!window.confirm(`Email a reminder to ${count} ${count === 1 ? "guest" : "guests"} who haven't added a design?`)) return;
          start(async () => setResult(await sendReminders(slug)));
        }}
      >
        {pending ? "Sending…" : `Email a reminder to ${count} ${count === 1 ? "guest" : "guests"}`}
      </button>
      {result?.error && <p style={{ color: "var(--pp-leather)", fontSize: "0.9rem", marginTop: "0.4rem" }}>{result.error}</p>}
      {result?.message && <p style={{ color: "var(--pp-accent)", fontSize: "0.9rem", marginTop: "0.4rem" }}>{result.message}</p>}
      {missingEmails > 0 && (
        <p className="pp-soft" style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
          {missingEmails} {missingEmails === 1 ? "guest has" : "guests have"} no email on the list yet.
        </p>
      )}
    </div>
  );
}
