export default function CardNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="font-display text-3xl">We couldn&apos;t find that card</h1>
      <p className="mt-3 text-ink-soft">
        The link may be incomplete. Try opening it again from the email, or ask the person who sent it for a fresh link.
      </p>
    </main>
  );
}
