import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listMessages } from "@/lib/messages";
import { getParty } from "@/lib/parties";
import { getTheme } from "@/themes";
import { MessageBoard } from "./MessageBoard";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.messages) notFound();

  const theme = getTheme(party.theme);
  const messages = await listMessages(party.id, { deviceHash: await currentDeviceHash(party) });

  return (
    <main className="pp-wrap">
      <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to the party
      </Link>

      <header style={{ textAlign: "center", marginTop: "1.75rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
          Notes, wishes &amp; advice
        </p>
        <h1 className="pp-script" style={{ fontSize: "3.4rem", color: "var(--pp-accent)", marginTop: "0.4rem" }}>
          Messages for {party.guestOfHonorName}
        </h1>
      </header>

      <MessageBoard slug={party.slug} guestOfHonorName={party.guestOfHonorName} theme={theme.id} messages={messages} />
    </main>
  );
}
