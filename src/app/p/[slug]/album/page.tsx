import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { getParty } from "@/lib/parties";
import { listPhotos } from "@/lib/photos";
import { Album } from "./Album";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party || !party.sections.album) notFound();

  const photos = await listPhotos(party.id, { deviceHash: await currentDeviceHash(party) });

  return (
    <main className="pp-wrap" style={{ maxWidth: "54rem" }}>
      <Link href={`/p/${party.slug}`} className="pp-back">
        ← Back to the party
      </Link>
      <header className="pp-head">
        <h1 className="pp-page-title">Photo album</h1>
        <p className="pp-page-kicker">Snapshots from everyone celebrating</p>
      </header>
      <Album slug={party.slug} guestOfHonorName={party.guestOfHonorName} photos={photos} />
    </main>
  );
}
