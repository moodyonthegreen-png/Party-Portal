import { notFound } from "next/navigation";
import { getHostParty } from "@/lib/host";
import { listMessages } from "@/lib/messages";
import { HostMessages } from "./HostMessages";

type Props = { params: Promise<{ slug: string }> };

export default async function HostMessagesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const messages = await listMessages(party.id, { includeHidden: true });

  return (
    <main style={{ paddingTop: "1.5rem" }}>
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
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
