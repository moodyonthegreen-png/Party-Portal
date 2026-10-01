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
      <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
        ← Back to the party
      </Link>
      <header style={{ textAlign: "center", marginTop: "1.75rem" }}>
        <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
          Snapshots from everyone celebrating
        </p>
        <h1 className="pp-script" style={{ fontSize: "3.4rem", color: "var(--pp-accent)", marginTop: "0.4rem" }}>
          Photo album
        </h1>
      </header>
      <Album slug={party.slug} guestOfHonorName={party.guestOfHonorName} photos={photos} />
    </main>
  );
}
