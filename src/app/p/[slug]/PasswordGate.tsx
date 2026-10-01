"use client";

import { useActionState } from "react";
import { unlockParty, type UnlockState } from "./actions";

export function PasswordGate({ slug, guestOfHonorName }: { slug: string; guestOfHonorName: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(
    unlockParty.bind(null, slug),
    {},
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <p className="text-sm tracking-wide text-ink-soft uppercase">You're invited</p>
      <h1 className="mt-2 font-display text-4xl leading-tight">{guestOfHonorName}'s party</h1>
      <p className="mt-3 text-ink-soft">This party has a password. You'll find it on your invitation.</p>
      <form action={action} className="mt-8 flex flex-col gap-3">
        <label htmlFor="password" className="text-sm font-medium">
          Party password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="off"
          required
          className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-moss focus:ring-2 focus:ring-moss/20"
        />
        {state.error && (
          <p role="alert" className="text-sm text-warn">
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          className="rounded-xl bg-moss px-4 py-3 font-medium text-white hover:bg-moss-dark disabled:opacity-60"
        >
          {pending ? "Checking…" : "Join the party"}
        </button>
      </form>
    </main>
  );
}
