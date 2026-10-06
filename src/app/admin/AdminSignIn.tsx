"use client";

import { useActionState } from "react";
import { adminSignIn, type SignInState } from "./auth-actions";

export function AdminSignIn({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(adminSignIn, {});
  return (
    <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
      <div className="pp-paper" style={{ padding: "2.5rem 1.5rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem", textAlign: "center" }}>
          Elebrate
        </p>
        <h1 className="pp-script" style={{ fontSize: "3rem", color: "var(--pp-accent)", textAlign: "center", margin: "0.4rem 0 1rem" }}>
          Admin
        </h1>
        {configured ? (
          <form action={action} style={{ display: "grid", gap: "0.75rem" }}>
            <label htmlFor="pw" className="pp-caps" style={{ fontSize: "0.72rem" }}>
              Password
            </label>
            <input id="pw" name="password" type="password" autoComplete="current-password" required className="pp-field" />
            {state.error && <p style={{ color: "var(--pp-leather)" }}>{state.error}</p>}
            <button className="pp-btn" disabled={pending}>
              {pending ? "Checking…" : "Sign in"}
            </button>
          </form>
        ) : (
          <p style={{ lineHeight: 1.55 }}>
            The admin area isn&apos;t switched on yet. Add an <code>ADMIN_PASSWORD</code> (at least 10 characters) in Vercel&apos;s
            environment variables and redeploy.
          </p>
        )}
      </div>
    </main>
  );
}
