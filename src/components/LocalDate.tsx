"use client";

import { useEffect, useState } from "react";

/**
 * Shows a date in the viewer's own time zone. Renders a neutral placeholder
 * on the server so there is no hydration mismatch.
 */
export function LocalDate({ iso, withTime = true }: { iso: string; withTime?: boolean }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    setText(
      d.toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      }),
    );
  }, [iso, withTime]);

  return <time dateTime={iso}>{text ?? " "}</time>;
}

/** "3 days left", "Ends today", "Closed" */
export function TimeLeft({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return setText("Closed");
    const days = Math.floor(ms / 86_400_000);
    if (days >= 2) return setText(`${days} days left`);
    if (days === 1) return setText("1 day left");
    const hours = Math.max(1, Math.floor(ms / 3_600_000));
    setText(hours === 1 ? "Ends within the hour" : `${hours} hours left`);
  }, [iso]);

  return <span>{text ?? " "}</span>;
}

/** Invitation-style date: SEPTEMBER | 25 | 2:00 PM, in the viewer's time zone. */
export function EventDate({ iso }: { iso: string }) {
  const [parts, setParts] = useState<{ month: string; day: string; time: string } | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    setParts({
      month: d.toLocaleString(undefined, { month: "long" }),
      day: d.toLocaleString(undefined, { day: "numeric" }),
      time: d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" }),
    });
  }, [iso]);

  const rule: React.CSSProperties = {
    borderTop: "1px solid currentColor",
    borderBottom: "1px solid currentColor",
    padding: "0.2rem 0.6rem",
    fontSize: "0.8rem",
    minWidth: "6.5rem",
  };

  return (
    <time
      dateTime={iso}
      className="pp-caps"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.8rem", minHeight: "3.2rem" }}
    >
      {parts && (
        <>
          <span style={rule}>{parts.month}</span>
          <span className="pp-display" style={{ fontSize: "2.6rem", letterSpacing: 0, lineHeight: 1 }}>
            {parts.day}
          </span>
          <span style={rule}>{parts.time}</span>
        </>
      )}
    </time>
  );
}

/** "Saturday, October 11 at 2:00 PM" in the viewer's own time zone. */
export function EventLine({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    setText(`${day} at ${time}`);
  }, [iso]);
  return <time dateTime={iso}>{text ?? "\u00a0"}</time>;
}
