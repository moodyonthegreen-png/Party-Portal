"use client";

import { useActionState } from "react";
import { requestHostLinks, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestHostLinks, {});

  if (state.sent) {
    return (
      <p className="mc-note" role="status">
        <strong>Check your inbox!</strong> If that email has a party with us, your link is on its way. It can take a minute to
        arrive, so peek in spam too.
      </p>
    );
  }

  return (
    <form action={action} className="mc-form" style={{ gap: "0.75rem" }}>
      <label htmlFor="email" className="mc-label">
        Email address
      </label>
      <input id="email" name="email" type="email" autoComplete="email" required className="mc-input" placeholder="you@example.com" />
      {state.error && (
        <p role="alert" className="mc-error">
          {state.error}
        </p>
      )}
      <button className="mc-button" disabled={pending}>
        {pending ? "Sending…" : "Email me my link"}
      </button>
    </form>
  );
}
