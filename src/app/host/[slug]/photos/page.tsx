import { notFound } from "next/navigation";
import { getHostParty } from "@/lib/host";
import { listPhotos } from "@/lib/photos";
import { HostPhotos } from "./HostPhotos";

type Props = { params: Promise<{ slug: string }> };

export default async function HostPhotosPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const photos = await listPhotos(party.id, { includeHidden: true, withOriginals: true });

  return (
    <main style={{ paddingTop: "1.5rem" }}>
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Photo album
        </h2>
        <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "1rem" }}>
          {party.sections.album
            ? "Photos appear for guests as soon as they're added. Hide anything you'd rather not show; hidden photos stay here so you can bring them back. Tap Full quality to save the original."
            : "The photo album is turned off. You can turn it on in Party details."}
        </p>
        <HostPhotos slug={party.slug} photos={photos} />
      </section>
    </main>
  );
}
