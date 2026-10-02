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
    <Link href={`/p/${party.slug}`} className="pp-caps pp-link" style={{ fontSize: "0.8rem" }}>
      ← Back to the party
    </Link>
  );
  const possessive = party.guestOfHonorName.endsWith("s")
    ? `${party.guestOfHonorName}'`
    : `${party.guestOfHonorName}'s`;

  if (!party.sections.design || !party.isOpen) {
    return (
      <main className="pp-wrap">
        {back}
        <div className="pp-paper" style={{ marginTop: "2rem", padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <h1 className="pp-script" style={{ fontSize: "3.2rem", color: "var(--pp-accent)" }}>
            Designs are closed
          </h1>
          <p style={{ marginTop: "1rem", lineHeight: 1.55 }}>
            The deadline has passed and {possessive} gift is being made. Thank you for being part of it.
          </p>
        </div>
      </main>
    );
  }

  const [guestNames, myDesigns] = await Promise.all([
    getGuestNames(party.id),
    getMyDesigns(party.id, await currentDeviceHash(party)),
  ]);

  return (
    <main className="pp-wrap">
      {back}
      <div className="pp-paper" style={{ marginTop: "2rem", padding: "2.25rem 1.25rem 1.75rem" }}>
        <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(-2deg)" }} />
        <div style={{ textAlign: "center" }}>
          <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem" }}>
            A gift from all of us
          </p>
          <h1 className="pp-script" style={{ fontSize: "3.3rem", color: "var(--pp-accent)", marginTop: "0.5rem" }}>
            Add your design
          </h1>
          <p className="pp-soft" style={{ marginTop: "0.6rem", lineHeight: 1.5 }}>
            Your drawing will be part of a one-of-a-kind gift for {party.guestOfHonorName}, made from designs by
            everyone celebrating. You can replace yours any time before the deadline.
          </p>
          {party.sections.games && party.games.raffle.on && party.games.raffle.rules.design && party.games.raffle.prizes.length > 0 && (
            <p className="pp-note" style={{ marginTop: "0.9rem", fontSize: "0.95rem" }}>
              🎟️ Adding a design enters you in the raffle to win {party.games.raffle.prizes.join(" or ")}!
            </p>
          )}
        </div>
        <DesignFlow
          slug={party.slug}
          guestNames={guestNames}
          requireGuestList={party.requireGuestList}
          allowDrawing
          myDesigns={myDesigns}
        />
      </div>
    </main>
  );
}
