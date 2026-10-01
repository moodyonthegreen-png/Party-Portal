"use client";

import { useState, useTransition } from "react";
import type { Message } from "@/lib/messages";
import { deleteMessage, setMessageHidden, type ActionState } from "../actions";

export function HostMessages({ slug, messages }: { slug: string; messages: Message[] }) {
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

  if (!messages.length) {
    return (
      <p className="pp-soft" style={{ marginTop: "1.25rem" }}>
        No notes yet.
      </p>
    );
  }

  const hiddenCount = messages.filter((m) => m.hidden).length;

  return (
    <div style={{ marginTop: "1.25rem", opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
      <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
        {messages.length} {messages.length === 1 ? "note" : "notes"}
        {hiddenCount ? ` · ${hiddenCount} hidden` : ""}
      </p>
      {error && (
        <p role="alert" style={{ color: "var(--pp-leather)", marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
      <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
        {messages.map((m) => (
          <li key={m.id} style={{ padding: "0.9rem 0", borderTop: "1px solid var(--pp-paper-edge)", opacity: m.hidden ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
              <strong style={{ fontWeight: 600 }}>{m.authorName}</strong>
              <span className="pp-soft" style={{ fontSize: "0.8rem" }}>
                {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              {m.hidden && (
                <span className="pp-soon" style={{ marginTop: 0 }}>
                  Hidden
                </span>
              )}
            </div>
            {m.body && <p style={{ marginTop: "0.35rem", whiteSpace: "pre-line", lineHeight: 1.5 }}>{m.body}</p>}
            {m.mediaType === "audio" && m.mediaUrl && (
              <audio src={m.mediaUrl} controls preload="none" style={{ width: "100%", marginTop: "0.5rem" }} />
            )}
            {m.mediaType === "video" && m.mediaUrl && (
              <video src={m.mediaUrl} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 300, marginTop: "0.5rem", borderRadius: 8, background: "#000" }} />
            )}
            <div style={{ display: "flex", gap: "1.25rem", marginTop: "0.5rem" }}>
              <button type="button" className="pp-link" style={{ fontSize: "0.9rem" }} onClick={() => run(() => setMessageHidden(slug, m.id, !m.hidden))}>
                {m.hidden ? "Show again" : "Hide"}
              </button>
              <button
                type="button"
                className="pp-link"
                style={{ fontSize: "0.9rem", color: "var(--pp-leather)" }}
                onClick={() => run(() => deleteMessage(slug, m.id), `Delete ${m.authorName}'s note for good?`)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
