import { notFound } from "next/navigation";
import { LocalDate } from "@/components/LocalDate";
import { emailConfigured } from "@/lib/email";
import { getHostParty, listCoHosts } from "@/lib/host";
import { getRevealData, getRevealSettings } from "@/lib/reveal";
import { KeepsakeControls } from "./KeepsakeControls";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function KeepsakePage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const [settings, coHosts, data] = await Promise.all([getRevealSettings(party.id), listCoHosts(party.id), getRevealData(party)]);
  const gohEmail = coHosts?.find((c) => c.role === "guest_of_honor")?.email ?? "";
  const first = party.guestOfHonorName.split(" ")[0];
  const g = data.games;

  const contents = [
    { ok: data.notes.length > 0, text: plural(data.notes.length, "guest book message") },
    { ok: data.photos.length > 0, text: plural(data.photos.length, "photo") },
    { ok: data.designs.length > 0, text: plural(data.designs.length, "design") },
    {
      ok: Boolean(g.babyPhoto?.length || g.pool || g.raffle.length),
      text: g.babyPhoto?.length || g.pool || g.raffle.length ? "Game winners" : "Game winners (once you reveal results or draw the raffle)",
    },
    {
      ok: Boolean(data.gift),
      text: data.gift ? `A photo of the finished ${data.gift.productName.toLowerCase()}` : "A photo of the finished gift (finish it in the Gift designer)",
    },
    ...(data.memorials.length
      ? [{ ok: true, text: `A "watching over you" page for ${data.memorials.map((m) => m.name).join(", ")}` }]
      : []),
  ];

  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem", display: "grid", gap: "1.75rem" }}>
      <header>
        <h2 className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)" }}>
          {first}’s keepsake
        </h2>
        <p className="pp-soft" style={{ fontSize: "1rem" }}>
          A step-through story of everything guests shared, for {first} to open on her own time and watch as often as she
          likes. It always shows the latest, so anything added later appears too.
        </p>
      </header>

      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", display: "grid", gap: "0.8rem" }}>
        <h3 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          What&apos;s in it so far
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
          {contents.map((c) => (
            <li key={c.text} className={c.ok ? undefined : "pp-soft"}>
              {c.ok ? "✓" : "○"} {c.text}
            </li>
          ))}
        </ul>
        <p className="pp-soft" style={{ fontSize: "0.9rem" }}>
          It ends with every guest&apos;s name: {plural(data.names.length, "person", "people")} so far.
        </p>
      </section>

      {settings ? (
        <KeepsakeControls
          slug={party.slug}
          firstName={first}
          initialEmail={settings.email ?? gohEmail}
          auto={settings.auto}
          sentAt={settings.sentAt}
          openedAt={settings.openedAt}
          canEmail={emailConfigured()}
          closesLabel={<LocalDate iso={party.deadline} />}
          isOpen={party.isOpen}
        />
      ) : (
        <p className="pp-note">The keepsake isn&apos;t switched on yet. Moody Celebrations needs to run one quick database update first.</p>
      )}
    </main>
  );
}
