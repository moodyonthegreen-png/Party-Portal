import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listMessages } from "@/lib/messages";
import { getParty } from "@/lib/parties";
import { GuestBook } from "./GuestBook";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.messages) notFound();

  const messages = await listMessages(party.id, { deviceHash: await currentDeviceHash(party) });

  return (
    <main className="pp-wrap" style={{ maxWidth: "54rem" }}>
      <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to the party
      </Link>

      <header style={{ textAlign: "center", marginTop: "1.75rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
          Notes, wishes, voice memos &amp; videos
        </p>
        <h1 className="pp-script" style={{ fontSize: "3.4rem", color: "var(--pp-accent)", marginTop: "0.4rem" }}>
          Guest book
        </h1>
      </header>

      <GuestBook slug={party.slug} guestOfHonorName={party.guestOfHonorName} messages={messages} />
    </main>
  );
}
