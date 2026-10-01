import { notFound } from "next/navigation";
import { listGiftSources, listPreviewPhotos, listSavedGifts } from "@/lib/gift";
import { ownedProducts } from "@/lib/gift/products";
import { getHostParty } from "@/lib/host";
import { printifyConfigured } from "@/lib/printify";
import { GiftDesigner } from "./GiftDesigner";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
// Talking to Printify after finalizing can take a little while
export const maxDuration = 60;

export default async function GiftPage({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound();

  const [sources, saved, previews] = await Promise.all([
    listGiftSources(party.id),
    listSavedGifts(party.id),
    listPreviewPhotos(party.id),
  ]);

  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>
      <header style={{ marginBottom: "1rem" }}>
        <h2 className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)" }}>
          Group gift designer
        </h2>
        <p className="pp-soft" style={{ fontSize: "1rem" }}>
          Arrange everyone&apos;s designs on {party.guestOfHonorName}&apos;s gift. Drag them anywhere, resize, rotate and layer them,
          then finalize to make the print file.
        </p>
      </header>
      <GiftDesigner
        slug={party.slug}
        guestOfHonorName={party.guestOfHonorName}
        sources={sources}
        saved={saved.map((s) => ({ ...s }))}
        designsOpen={party.isOpen}
        owned={ownedProducts(party.giftProduct, party.extraProducts)}
        printify={printifyConfigured()}
        previews={previews}
      />
    </main>
  );
}
