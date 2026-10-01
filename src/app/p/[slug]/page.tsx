import { notFound } from "next/navigation";
import { TimeLeft, EventDate } from "@/components/LocalDate";
import { Motif } from "@/components/Motif";
import { defaultTagline, defaultWelcome } from "@/lib/copy";
import { getParty } from "@/lib/parties";
import { getTheme } from "@/themes";
import { EnvelopeOpener } from "./EnvelopeOpener";
import { SectionObject } from "./SectionObject";

type Props = { params: Promise<{ slug: string }> };

export default async function PartyHome({ params }: Props) {
  const { slug } = await params;
  const party = await getParty(slug);
  if (!party) notFound();

  const theme = getTheme(party.theme);
  const base = `/p/${party.slug}`;
  // Both are the host's own words when they've written them
  const tagline = party.tagline ?? defaultTagline(party.occasion);
  const welcome = party.welcomeMessage ?? defaultWelcome(party.guestOfHonorName);

  return (
    <>
      <EnvelopeOpener slug={party.slug} name={party.guestOfHonorName} occasion={party.occasion} motif={theme.motif} />

      <main className="pp-wrap">
        {/* The guest of honor */}
        <section style={{ position: "relative", marginTop: "1.75rem" }}>
          <div
            className="pp-paper"
            style={{ transform: "rotate(-1.2deg)", padding: "2.6rem 1.5rem 2.2rem", textAlign: "center" }}
          >
            <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(-3deg)" }} />
            <p className="pp-caps pp-soft" style={{ fontSize: "0.78rem" }}>
              We&apos;re celebrating
            </p>
            <h1
              className="pp-script"
              style={{ fontSize: "clamp(3.6rem, 18vw, 5rem)", margin: "0.7rem 0 0.4rem", color: "var(--pp-accent)" }}
            >
              {party.guestOfHonorName}
            </h1>
            {party.title && (
              <p className="pp-display" style={{ fontSize: "1.35rem", fontStyle: "italic", marginBottom: "0.4rem" }}>
                {party.title}
              </p>
            )}
            {tagline && (
              <p className="pp-caps" style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>
                {tagline}
              </p>
            )}
            {party.eventDate && (
              <div style={{ margin: "1.3rem 0 0.2rem" }}>
                <EventDate iso={party.eventDate} />
              </div>
            )}
            <p style={{ marginTop: "1.2rem", lineHeight: 1.55, whiteSpace: "pre-line" }}>{welcome}</p>
          </div>
          <div
            className="pp-stamp"
            style={{ position: "absolute", right: "-4px", bottom: "-24px", width: 68, height: 82, transform: "rotate(8deg)" }}
            aria-hidden="true"
          >
            <div className="pp-stamp-inner">
              <Motif motif={theme.motif} size={26} />
            </div>
          </div>
        </section>

        {/* Things to do */}
        <p className="pp-caps pp-soft" style={{ textAlign: "center", margin: "3.25rem 0 1.5rem", fontSize: "0.8rem" }}>
          Things to do at the party
        </p>

        <div className="pp-board">
          {party.sections.design && (
            <SectionObject
              section="design"
              theme={theme}
              href={`${base}/design`}
              label="Add your design"
              detail={
                party.isOpen ? (
                  <>
                    <TimeLeft iso={party.deadline} /> to add yours
                  </>
                ) : (
                  "Designs are closed"
                )
              }
              tilt={-2}
            />
          )}
          {party.sections.album && (
            <SectionObject
              section="album"
              theme={theme}
              href={`${base}/album`}
              label="Photo album"
              detail="Share your snapshots"
              soon
              tilt={2}
            />
          )}
          {party.sections.messages && (
            <SectionObject
              section="messages"
              theme={theme}
              href={`${base}/messages`}
              label="Messages"
              detail="Notes, wishes & advice"
              soon
              tilt={1.5}
            />
          )}
          {party.sections.games && (
            <SectionObject
              section="games"
              theme={theme}
              href={`${base}/games`}
              label="Games"
              detail="Play & top the leaderboard"
              soon
              tilt={-2.5}
            />
          )}
          {/* Shown whenever the host has added a registry link */}
          {party.registryUrl && (
            <SectionObject
              section="registry"
              theme={theme}
              href={party.registryUrl}
              external
              tilt={3}
              style={{ gridColumn: "1 / -1", width: "50%", justifySelf: "center" }}
            />
          )}
        </div>
      </main>
    </>
  );
}
