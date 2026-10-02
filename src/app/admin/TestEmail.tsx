"use client";

import { useActionState } from "react";
import { sendTestEmail, type AdminState } from "./actions";

export function TestEmail({ from }: { from: string | null }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(sendTestEmail, {});
  return (
    <form action={action} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
      <span className="pp-soft" style={{ fontSize: "0.9rem" }}>
        Email {from ? `(from ${from})` : "(not set up yet)"}:
      </span>
      <input name="to" type="email" placeholder="you@example.com" className="pp-field" style={{ width: "auto", minWidth: 220, padding: "0.5rem 0.75rem", fontSize: "0.95rem" }} />
      <button className="pp-btn pp-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.55rem 0.9rem" }} disabled={pending}>
        {pending ? "Sending…" : "Send a test email"}
      </button>
      {state.error && <span style={{ color: "var(--pp-leather)", fontSize: "0.9rem" }}>{state.error}</span>}
      {state.message && <span style={{ color: "var(--pp-accent)", fontSize: "0.9rem" }}>{state.message}</span>}
    </form>
  );
}
