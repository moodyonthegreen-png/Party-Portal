import Link from "next/link";
import { notFound } from "next/navigation";
import { EventLine, TimeLeft } from "@/components/LocalDate";
import { Icon, Ornament, type IconName } from "@/components/Icon";
import { defaultTagline, defaultWelcome } from "@/lib/copy";
import { countMessages } from "@/lib/messages";
import { albumPreview } from "@/lib/photos";
import { getParty } from "@/lib/parties";
import { DESIGNS_BUCKET, supabaseAdmin } from "@/lib/supabase/admin";

type Props = { params: Promise<{ slug: string }> };

/** A few recent designs and the newest note, so the contents show real things. */
async function previews(partyId: string) {
  const db = supabaseAdmin();
  const [designs, note] = await Promise.all([
    db.from("designs").select("image_path").eq("party_id", partyId).eq("status", "visible").order("created_at", { ascending: false }).limit(4),
    db.from("messages").select("author_name, body").eq("party_id", partyId).eq("status", "visible").not("body", "is", null).order("created_at", { ascending: false }).limit(1),
  ]);
  const paths = (designs.data ?? []).map((d) => d.image_path as string);
  let designUrls: string[] = [];
  if (paths.length) {
    const { data } = await db.storage.from(DESIGNS_BUCKET).createSignedUrls(paths, 60 * 60);
    designUrls = (data ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
  }
  const n = note.data?.[0];
  return { designUrls, note: n ? { author: n.author_name as string, body: String(n.body) } : null };
}

function Entry({
  href,
  title,
  detail,
  art,
  external = false,
}: {
  href: string;
  title: string;
  detail: React.ReactNode;
  art: React.ReactNode;
  external?: boolean;
}) {
  const body = (
    <>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <div className="pp-entry-art">{art}</div>
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="pp-paper pp-entry">
      {body}
    </a>
  ) : (
    <Link href={href} className="pp-paper pp-entry">
      {body}
    </Link>
  );
}

const IconArt = ({ name }: { name: IconName }) => (
  <span className="pp-entry-icon">
    <Icon name={name} size={28} />
  </span>
);

export default async function PartyHome({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  const base = `/p/${party.slug}`;
  // Both are the host's own words when they've written them
  const tagline = party.tagline ?? defaultTagline(party.occasion);
  const welcome = party.welcomeMessage ?? defaultWelcome(party.guestOfHonorName);
  const [messageCount, album, more] = await Promise.all([
    party.sections.messages ? countMessages(party.id) : 0,
    party.sections.album ? albumPreview(party.id) : { count: 0, urls: [] },
    previews(party.id),
  ]);
  const raffle = party.games.raffle;
  const excerpt = more.note ? (more.note.body.length > 70 ? `${more.note.body.slice(0, 68).trimEnd()}…` : more.note.body) : null;

  return (
    <main className="pp-wrap pp-home">
      {/* The book cover */}
      <div className="pp-home-cover">
      <section className="pp-cover">
        <Ornament />
        <p className="pp-cover-sub" style={{ marginTop: "1.1rem", opacity: 0.92 }}>
          Celebrating
        </p>
        <h1 className="pp-cover-name pp-foil">{party.guestOfHonorName}</h1>
        {party.title && <p className="pp-cover-sub">{party.title}</p>}
        {tagline && <p className="pp-cover-sub">{tagline}</p>}
        {party.eventDate && (
          <p className="pp-cover-meta">
            <EventLine iso={party.eventDate} />
          </p>
        )}
      </section>
      </div>

      <div className="pp-home-body">
      {/* A note from the host */}
      <section className="pp-paper pp-letter">
        <p>{welcome}</p>
      </section>

      <h2 className="pp-contents-title">At the party</h2>
      <div className="pp-contents" style={{ marginTop: "1rem" }}>
        {party.sections.design && (
          <Entry
            href={`${base}/design`}
            title="Add your design"
            detail={
              party.isOpen ? (
                <>
                  A drawing for {party.guestOfHonorName.split(" ")[0]}&apos;s keepsake gift. <TimeLeft iso={party.deadline} /> to add yours.
                </>
              ) : (
                "Designs are closed. Thank you, everyone!"
              )
            }
            art={
              more.designUrls.length ? (
                <span className="pp-swatches">
                  {more.designUrls.slice(0, 4).map((u) => (
                    <img key={u} src={u} alt="" />
                  ))}
                </span>
              ) : (
                <IconArt name="pencil" />
              )
            }
          />
        )}
        {party.sections.messages && (
          <Entry
            href={`${base}/messages`}
            title="Guest book"
            detail={
              excerpt ? (
                <>
                  <span className="pp-serif-italic" style={{ fontSize: "1.1rem", color: "var(--pp-ink)" }}>
                    &ldquo;{excerpt}&rdquo;
                  </span>
                  <br />
                  {messageCount} {messageCount === 1 ? "note" : "notes"} so far
                </>
              ) : messageCount > 0 ? (
                `${messageCount} ${messageCount === 1 ? "note" : "notes"} so far. Add yours.`
              ) : (
                "Leave a note, a voice memo or a video."
              )
            }
            art={
              <span className="pp-mini-book">
                <span />
              </span>
            }
          />
        )}
        {party.sections.album && (
          <Entry
            href={`${base}/album`}
            title="Photo album"
            detail={album.count > 0 ? `${album.count} ${album.count === 1 ? "photo" : "photos"} shared` : "Share a favorite photo."}
            art={
              album.urls.length ? (
                <span className="pp-thumbs">
                  {[...album.urls].reverse().map((u) => (
                    <img key={u} src={u} alt="" />
                  ))}
                </span>
              ) : (
                <IconArt name="camera" />
              )
            }
          />
        )}
        {party.sections.games && (
          <Entry
            href={`${base}/games`}
            title="Games"
            detail={
              party.games.pool.actual || party.games.babyPhotos.revealed
                ? "The results are in."
                : raffle.on && raffle.prizes.length
                  ? `Play along, and you could win ${raffle.prizes[0]}.`
                  : "Guess the baby photo, pick the due date, and more."
            }
            art={<IconArt name={raffle.on && raffle.prizes.length ? "ticket" : "games"} />}
          />
        )}
        {party.registryUrl && (
          <Entry href={party.registryUrl} external title="Registry" detail="Opens the registry in a new tab." art={<IconArt name="gift" />} />
        )}
      </div>

      <p className="pp-soft" style={{ textAlign: "center", fontSize: "0.85rem", marginTop: "3rem" }}>
        Made with love by Moody Celebrations
      </p>
      </div>
    </main>
  );
}
