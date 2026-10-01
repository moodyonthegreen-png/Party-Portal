"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-ink-soft">
        We couldn't load this page. Please try again in a moment. If it keeps happening, let the host know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-moss px-4 py-3 font-medium text-white hover:bg-moss-dark"
      >
        Try again
      </button>
      {error.digest && <p className="mt-6 text-xs text-ink-soft">Reference: {error.digest}</p>}
    </main>
  );
}
