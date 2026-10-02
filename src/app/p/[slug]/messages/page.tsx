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
      <Link href={`/p/${party.slug}`} className="pp-back">
        ← Back to the party
      </Link>

      <header className="pp-head">
        <h1 className="pp-page-title">Guest book</h1>
        <p className="pp-page-kicker">Notes, wishes, voice memos &amp; videos</p>
      </header>

      <GuestBook slug={party.slug} guestOfHonorName={party.guestOfHonorName} messages={messages} />
    </main>
  );
}
