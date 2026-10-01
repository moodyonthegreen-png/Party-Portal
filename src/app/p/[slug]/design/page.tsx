import Link from "next/link";
import { notFound } from "next/navigation";
import { currentDeviceHash } from "@/lib/device";
import { getGuestNames, getParty } from "@/lib/parties";
import { DESIGNS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { DesignFlow, type MyDesign } from "./DesignFlow";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** Designs this browser has already added, so guests can see and replace them. */
async function getMyDesigns(partyId: string, deviceHash: string | null): Promise<MyDesign[]> {
  if (!deviceHash) return [];
  const db = supabaseAdmin();
  const { data } = await db
    .from("guests")
    .select("name, designs(image_path, updated_at)")
    .eq("party_id", partyId)
    .eq("claim_token_hash", deviceHash);
  if (!data) return [];

  const withDesigns = data
    .map((g) => {
      const d = (g.designs as unknown as { image_path: string; updated_at: string }[] | null)?.[0];
      return d ? { name: g.name, path: d.image_path, updatedAt: d.updated_at } : null;
    })
    .filter((x): x is { name: string; path: string; updatedAt: string } => x !== null);
  if (!withDesigns.length) return [];

  const { data: signed } = await db.storage
    .from(DESIGNS_BUCKET)
    .createSignedUrls(withDesigns.map((d) => d.path), 60 * 60);

  return withDesigns.map((d, i) => ({ name: d.name, updatedAt: d.updatedAt, url: signed?.[i]?.signedUrl ?? null }));
}

export default async function DesignPage({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  const back = (
    <Link href={`/p/${party.slug}`} className="text-sm font-medium text-moss underline-offset-4 hover:underline">
      ← Back to the party
    </Link>
  );

  if (!party.sections.design || !party.isOpen) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-8 pb-16">
        {back}
        <h1 className="mt-6 font-display text-3xl">Designs are closed</h1>
        <p className="mt-3 text-ink-soft">
          The deadline has passed and the blanket is being made. Thank you for being part of it.
        </p>
      </main>
    );
  }

  const [guestNames, myDesigns] = await Promise.all([
    getGuestNames(party.id),
    getMyDesigns(party.id, await currentDeviceHash(party)),
  ]);

  return (
    <main className="mx-auto max-w-xl px-5 pt-8 pb-16">
      {back}
      <h1 className="mt-6 font-display text-3xl sm:text-4xl">Add my design</h1>
      <p className="mt-2 text-ink-soft">
        For {party.guestOfHonorName}'s blanket. You can replace it any time before the deadline.
      </p>
      <DesignFlow
        slug={party.slug}
        guestNames={guestNames}
        requireGuestList={party.requireGuestList}
        allowDrawing
        myDesigns={myDesigns}
      />
    </main>
  );
}
