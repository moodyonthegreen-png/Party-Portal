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
