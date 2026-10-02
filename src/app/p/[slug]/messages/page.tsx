import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { listMemorials } from "@/lib/memorials";
import { listMessages } from "@/lib/messages";
import { getParty } from "@/lib/parties";
import { GuestBook } from "./GuestBook";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.messages) notFound();

  const [messages, memorials] = await Promise.all([
    listMessages(party.id, { deviceHash: await currentDeviceHash(party) }),
    listMemorials(party.id),
  ]);

  return (
    <main className="pp-wrap" style={{ maxWidth: "54rem" }}>
      <Link href={`/p/${party.slug}`} className="pp-back">
        ← Back to the party
      </Link>

      <header className="pp-head">
        <h1 className="pp-page-title">Guest book</h1>
        <p className="pp-page-kicker">Notes, wishes, voice memos &amp; videos</p>
      </header>

      <GuestBook slug={party.slug} guestOfHonorName={party.guestOfHonorName} messages={messages} memorials={memorials.items} />
    </main>
  );
}
