"use client";

import { useActionState } from "react";
import { requestHostLinks, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestHostLinks, {});

  if (state.sent) {
    return (
      <p className="pp-note" role="status" style={{ marginTop: "1.5rem", textAlign: "center" }}>
        Check your inbox! If that email has a party with us, your link is on its way. It can take a minute to arrive, so peek in
        spam too.
      </p>
    );
  }

  return (
    <form action={action} style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
      <label htmlFor="email" className="pp-caps" style={{ fontSize: "0.72rem" }}>
        Email address
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className="pp-field" />
      {state.error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {state.error}
        </p>
      )}
      <button className="pp-btn" disabled={pending}>
        {pending ? "Sending…" : "Email me my link"}
      </button>
    </form>
  );
}
