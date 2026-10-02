import { notFound } from "next/navigation";
import { LocalDate, TimeLeft } from "@/components/LocalDate";
import { emailConfigured } from "@/lib/email";
import { getHostParty } from "@/lib/host";
import { siteOrigin } from "@/lib/site";
import { DESIGNS_BUCKET, dbError, supabaseAdmin } from "@/lib/supabase/admin";
import { DownloadAll } from "./DownloadAll";
import { AddGuestsForm, CopyButton, GuestList, ReminderButton, type GuestRow } from "./OverviewClient";

type Props = { params: Promise<{ slug: string }> };

async function loadGuests(partyId: string): Promise<GuestRow[]> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("guests")
    .select("id, name, email, added_by, reminded_at, created_at, designs(image_path, status, updated_at)")
    .eq("party_id", partyId)
    .order("name");
  if (error) throw dbError("loading guest list", error);

  const rows = (data ?? []).map((g) => {
    const d = (g.designs as unknown as { image_path: string; status: string; updated_at: string }[] | null)?.[0];
    return {
      id: g.id as string,
      name: g.name as string,
      addedBy: g.added_by as "host" | "guest",
      email: (g.email as string | null) ?? null,
      remindedAt: (g.reminded_at as string | null) ?? null,
      design: d ? { path: d.image_path, hidden: d.status === "hidden", updatedAt: d.updated_at, url: null as string | null } : null,
    };
  });

  const paths = rows.filter((r) => r.design).map((r) => r.design!.path);
  if (paths.length) {
    const { data: signed } = await db.storage.from(DESIGNS_BUCKET).createSignedUrls(paths, 60 * 60);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const r of rows) if (r.design) r.design.url = byPath.get(r.design.path) ?? null;
  }

  return rows.map(({ id, name, addedBy, email, remindedAt, design }) => ({
    id,
    name,
    addedBy,
    email,
    remindedAt,
    design: design ? { url: design.url, hidden: design.hidden, updatedAt: design.updatedAt } : null,
  }));
}

export default async function HostOverview({ params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);
  if (!party) notFound(); // the layout already shows the "hosts only" message

  const db = supabaseAdmin();
  const [guests, origin, notes, media, photos] = await Promise.all([
    loadGuests(party.id),
    siteOrigin(),
    db.from("messages").select("id", { count: "exact", head: true }).eq("party_id", party.id).eq("status", "visible"),
    db.from("messages").select("id", { count: "exact", head: true }).eq("party_id", party.id).eq("status", "visible").not("media_path", "is", null),
    db.from("photos").select("id", { count: "exact", head: true }).eq("party_id", party.id).eq("status", "visible"),
  ]);
  const guestLink = `${origin}/p/${party.slug}`;
  const added = guests.filter((g) => g.design).length;
  const total = guests.length;
  const pct = total ? Math.round((added / total) * 100) : 0;

  const inviteText = `You're invited to celebrate ${party.guestOfHonorName}! Join the party here: ${guestLink}`;
  const reminderText = `Friendly reminder: there's still time to add your design for ${party.guestOfHonorName}'s gift! It only takes a minute: ${guestLink}`;

  return (
    <main style={{ paddingTop: "1.5rem", display: "grid", gap: "1.75rem" }}>
      {/* Share */}
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Share with your guests
        </h2>
        <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "1rem" }}>
          Everyone uses this one link. No accounts or apps needed.
        </p>
        <div
          style={{
            marginTop: "0.9rem",
            padding: "0.75rem 0.9rem",
            background: "#fff",
            border: "1px dashed var(--pp-paper-edge)",
            borderRadius: 10,
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.85rem",
            wordBreak: "break-all",
          }}
        >
          {guestLink}
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
          <CopyButton text={guestLink} label="Copy link" />
          <CopyButton text={inviteText} label="Copy invitation message" ghost />
        </div>
      </section>

      {/* Progress */}
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Designs for the group gift
        </h2>
        <p style={{ marginTop: "0.6rem" }}>
          <span className="pp-display" style={{ fontSize: "2.4rem", fontWeight: 600 }}>
            {added}
          </span>{" "}
          <span className="pp-soft">of {total} guests have added a design</span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ marginTop: "0.6rem", height: 10, borderRadius: 999, background: "var(--pp-accent-soft)", overflow: "hidden" }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--pp-accent)", borderRadius: 999 }} />
        </div>
        <p className="pp-soft" style={{ marginTop: "0.75rem", fontSize: "0.95rem" }}>
          {party.isOpen ? (
            <>
              Deadline: <LocalDate iso={party.deadline} /> (<TimeLeft iso={party.deadline} />)
            </>
          ) : (
            <>
              The deadline has passed (<LocalDate iso={party.deadline} />).
            </>
          )}
        </p>
        {party.isOpen && total > added && (
          <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.6rem" }}>
            {emailConfigured() && (
              <ReminderButton
                slug={party.slug}
                count={guests.filter((g) => !g.design && g.email).length}
                missingEmails={guests.filter((g) => !g.design && !g.email).length}
              />
            )}
            <div>
              <CopyButton text={reminderText} label="Copy a reminder message" ghost />
              <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "0.85rem" }}>
                Paste it into a group text for anyone without an email on the list.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Guests */}
      <section className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 4 }}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Guest list
        </h2>
        <p className="pp-soft" style={{ marginTop: "0.4rem", fontSize: "1rem" }}>
          Optional. Names here appear in the &quot;Who is this from?&quot; list, so it&apos;s easy to see who hasn&apos;t added
          a design yet.{" "}
          {party.requireGuestList
            ? "Right now only guests on this list can add a design (you can change that in Party details)."
            : "Guests who aren't listed can still type their own name."}
        </p>
        <AddGuestsForm slug={party.slug} withEmails={emailConfigured()} />
        <GuestList slug={party.slug} guests={guests} />
      </section>

      <DownloadAll
        slug={party.slug}
        counts={{
          notes: notes.count ?? 0,
          media: media.count ?? 0,
          photos: photos.count ?? 0,
          designs: guests.filter((g) => g.design && !g.design.hidden).length,
        }}
      />
    </main>
  );
}
