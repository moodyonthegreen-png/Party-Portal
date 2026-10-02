"use client";

import { useActionState } from "react";
import { unlockParty, type UnlockState } from "./actions";

export function PasswordGate({ slug, guestOfHonorName }: { slug: string; guestOfHonorName: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(
    unlockParty.bind(null, slug),
    {},
  );

  return (
    <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
      <div className="pp-paper" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.78rem" }}>
          You&apos;re invited to celebrate
        </p>
        <h1 className="pp-page-title">
          {guestOfHonorName}
        </h1>
        <p className="pp-soft">This party has a password. You&apos;ll find it on your invitation.</p>
        <form action={action} style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", textAlign: "left" }}>
          <label htmlFor="password" className="pp-caps" style={{ fontSize: "0.75rem" }}>
            Party password
          </label>
          <input id="password" name="password" type="password" autoComplete="off" required className="pp-field" />
          {state.error && (
            <p role="alert" style={{ color: "var(--pp-leather)", fontSize: "0.95rem" }}>
              {state.error}
            </p>
          )}
          <button disabled={pending} className="pp-btn" style={{ marginTop: "0.5rem" }}>
            {pending ? "Checking…" : "Join the party"}
          </button>
        </form>
      </div>
    </main>
  );
}
