import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalDate, TimeLeft } from "@/components/LocalDate";
import { getParty } from "@/lib/parties";

type Props = { params: Promise<{ slug: string }> };

const STEPS = [
  { title: "Draw", body: "Use the drawing card from your envelope. Anything goes: a doodle, a wish, a little picture." },
  { title: "Snap", body: "Take a photo of your card in good light, straight on, so it fills most of the frame." },
  { title: "Send", body: "Add it here. We clean it up and it becomes a square on the blanket." },
];

export default async function PartyWelcome({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  const base = `/p/${party.slug}`;
  const sections = [
    party.sections.album && { href: `${base}/album`, label: "Photo album", soon: true },
    party.sections.messages && { href: `${base}/messages`, label: "Message board", soon: true },
    party.sections.games && { href: `${base}/games`, label: "Games", soon: true },
    party.sections.registry && party.registryUrl && { href: party.registryUrl, label: "Registry", soon: false },
  ].filter(Boolean) as { href: string; label: string; soon: boolean }[];

  return (
    <main className="mx-auto max-w-xl px-5 pt-10 pb-16">
      <header>
        <p className="text-sm tracking-wide text-ink-soft uppercase">{party.occasion}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">
          {party.title ?? `Celebrating ${party.guestOfHonorName}`}
        </h1>
        {party.welcomeMessage && <p className="mt-4 text-lg leading-relaxed text-ink-soft">{party.welcomeMessage}</p>}
      </header>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        {party.isOpen ? (
          <>
            <p className="text-sm text-ink-soft">Add your design by</p>
            <p className="mt-1 text-lg font-medium">
              <LocalDate iso={party.deadline} />
            </p>
            <p className="mt-1 text-sm font-medium text-moss">
              <TimeLeft iso={party.deadline} />
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Designs are closed</p>
            <p className="mt-1 text-sm text-ink-soft">
              The deadline has passed and the blanket is being made. Thank you for being part of it.
            </p>
          </>
        )}
      </section>

      {party.sections.design && (
        <section className="mt-10">
          <h2 className="font-display text-2xl">How it works</h2>
          <ol className="mt-5 space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush-soft font-display text-lg text-moss-dark">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-0.5 text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          {party.isOpen && (
            <Link
              href={`${base}/design`}
              className="mt-8 block rounded-xl bg-moss px-4 py-4 text-center text-lg font-medium text-white hover:bg-moss-dark"
            >
              Add my design
            </Link>
          )}
        </section>
      )}

      {sections.length > 0 && (
        <nav className="mt-12" aria-label="More at this party">
          <h2 className="font-display text-2xl">More at the party</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {sections.map((s) => (
              <li key={s.label}>
                {s.soon ? (
                  <span className="block rounded-xl border border-dashed border-line p-4 text-ink-soft">
                    {s.label}
                    <span className="mt-1 block text-xs">Coming soon</span>
                  </span>
                ) : (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-line bg-card p-4 hover:border-moss"
                  >
                    {s.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
