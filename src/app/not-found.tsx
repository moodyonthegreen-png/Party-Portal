import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="font-display text-3xl">We couldn't find that party</h1>
      <p className="mt-3 text-ink-soft">Double-check the link or code on your invitation.</p>
      <Link href="/" className="mt-6 font-medium text-moss underline underline-offset-4">
        Try another code
      </Link>
    </main>
  );
}
