import { notFound } from "next/navigation";
import { getHostParty } from "@/lib/host";
import { listMemorials, MAX_MEMORIALS, MEMORIAL_SUGGESTION } from "@/lib/memorials";
import { listMessages } from "@/lib/messages";
import { HostMemorials } from "./HostMemorials";
import { HostMessages } from "./HostMessages";

type Props = { params: Promise<{ slug: string }> };

export default async function HostMessagesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const [messages, memorials] = await Promise.all([listMessages(party.id, { includeHidden: true }), listMemorials(party.id)]);

  return (
    <main style={{ paddingTop: "1.5rem", display: "grid", gap: "1.25rem" }}>
      <HostMemorials
        slug={party.slug}
        firstName={party.guestOfHonorName.split(" ")[0]}
        items={memorials.items}
        ready={memorials.ready}
        max={MAX_MEMORIALS}
        suggestion={MEMORIAL_SUGGESTION}
      />
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem" }}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Guest book
        </h2>
        <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "1rem" }}>
          {party.sections.messages
            ? "Notes appear for guests as soon as they're posted. Hide anything you'd rather not show; hidden notes stay here so you can bring them back."
            : "The guest book is turned off. You can turn it on in Party details."}
        </p>
        <HostMessages slug={party.slug} messages={messages} />
      </section>
    </main>
  );
}
