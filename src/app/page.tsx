import { redirect } from "next/navigation";

/** "Find My Party" landing. Guests usually arrive by link or QR code instead. */
export default function Home() {
  async function findParty(formData: FormData) {
    "use server";
    const raw = String(formData.get("code") ?? "").trim();
    // Accept a bare code ("harper-shower") or a pasted link ("…/p/harper-shower").
    const slug = raw.split("/p/").pop()?.split(/[/?#]/)[0]?.toLowerCase() ?? "";
    if (slug) redirect(`/p/${encodeURIComponent(slug)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <p className="text-sm tracking-wide text-ink-soft uppercase">Moody Celebrations</p>
      <h1 className="mt-2 font-display text-4xl leading-tight">Find your party</h1>
      <p className="mt-3 text-ink-soft">
        Enter the party code from your invitation, or paste the link you were sent.
      </p>
      <form action={findParty} className="mt-8 flex flex-col gap-3">
        <label htmlFor="code" className="text-sm font-medium">
          Party code or link
        </label>
        <input
          id="code"
          name="code"
          required
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="harper-shower"
          className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-moss focus:ring-2 focus:ring-moss/20"
        />
        <button className="rounded-xl bg-moss px-4 py-3 font-medium text-white hover:bg-moss-dark">
          Go to party
        </button>
      </form>
    </main>
  );
}
