import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { listPartySummaries, STAGE_LABEL } from "@/lib/admin-data";
import { listGiftSources, listSavedGifts } from "@/lib/gift";
import { PRODUCTS } from "@/lib/gift/products";
import { emailConfigured } from "@/lib/email";
import { HostLinkTools, PartyEditForm, StatusButtons } from "./PartyAdminClient";

type Props = { params: Promise<{ slug: string }> };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export default async function AdminParty({ params }: Props) {
  if (!(await isAdmin())) return null;
  const { slug } = await params;
  const party = (await listPartySummaries()).find((p) => p.slug === slug);
  if (!party) notFound();

  const [gifts, designs] = await Promise.all([listSavedGifts(party.id), listGiftSources(party.id)]);
  const card: React.CSSProperties = { padding: "1.4rem 1.25rem", borderRadius: 8, display: "grid", gap: "0.75rem" };

  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem", display: "grid", gap: "1.5rem" }}>
      <div>
        <Link href="/admin" className="pp-caps pp-link" style={{ fontSize: "0.75rem" }}>
          ← All parties
        </Link>
        <h1 className="pp-script" style={{ fontSize: "2.8rem", color: "var(--pp-accent)", marginTop: "0.5rem" }}>
          {party.guestOfHonorName}’s {party.occasion.toLowerCase()}
        </h1>
        <p className="pp-soft">
          Code <strong>{party.slug}</strong> · created {fmt(party.createdAt)} · <strong>{STAGE_LABEL[party.stage]}</strong>
        </p>
      </div>

      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <section className="pp-paper" style={card}>
          <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
            At a glance
          </h2>
          <table className="pp-board-table">
            <tbody>
              <tr><td className="pp-soft">Party date</td><td>{fmt(party.eventDate)}</td></tr>
              <tr><td className="pp-soft">Design deadline</td><td>{fmt(party.deadline)} {party.isOpen ? "" : "(passed)"}</td></tr>
              <tr><td className="pp-soft">Designs</td><td>{party.counts.designs} from {party.counts.guests} guests on the list</td></tr>
              <tr><td className="pp-soft">Photos</td><td>{party.counts.photos}</td></tr>
              <tr><td className="pp-soft">Guest book notes</td><td>{party.counts.notes}</td></tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <a href={`/p/${party.slug}`} target="_blank" rel="noopener noreferrer" className="pp-link">
              Open guest page ↗
            </a>
          </div>
        </section>

        <section className="pp-paper" style={card}>
          <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
            Host access
          </h2>
          <p style={{ fontSize: "0.95rem" }}>
            {party.hostName ? `${party.hostName} · ` : ""}
            {party.hostEmail}
          </p>
          <HostLinkTools slug={party.slug} canEmail={emailConfigured()} />
        </section>

        <section className="pp-paper" style={card}>
          <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
            Order details
          </h2>
          <PartyEditForm
            slug={party.slug}
            hostEmail={party.hostEmail}
            hostName={party.hostName ?? ""}
            giftProduct={party.products[0]?.key ?? "fleece-blanket"}
            extras={party.products.slice(1).map((p) => p.key)}
            products={Object.values(PRODUCTS).map((p) => ({ key: p.key, name: p.name }))}
          />
        </section>
      </div>

      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
          Gifts &amp; print files
        </h2>
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {party.products.map((prod) => {
            const g = gifts.find((x) => x.productKey === prod.key);
            return (
              <div key={prod.key} style={{ borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem", display: "grid", gap: "0.6rem" }}>
                <p style={{ fontWeight: 600 }}>
                  {prod.name}{" "}
                  <span className="pp-soft" style={{ fontWeight: 400, fontSize: "0.9rem" }}>
                    · {PRODUCTS[prod.key].widthPx} × {PRODUCTS[prod.key].heightPx} px · Printify #{PRODUCTS[prod.key].printifyBlueprintId}
                  </span>
                </p>
                {!g ? (
                  <p className="pp-soft">The host hasn&apos;t started designing yet.</p>
                ) : g.status !== "final" ? (
                  <p className="pp-soft">Draft in progress (last saved {fmt(g.updatedAt)}). Not finalized yet.</p>
                ) : (
                  <>
                    <p>
                      ✓ Finalized {fmt(g.finalizedAt)}
                      {g.provider ? ` · Printify provider: ${g.provider}` : ""}{" "}
                      {g.printUrl && (
                        <a href={g.printUrl} className="pp-link" style={{ marginLeft: 8 }}>
                          Download print file
                        </a>
                      )}
                    </p>
                    {g.mockups.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.5rem" }}>
                        {g.mockups.slice(0, 6).map((m) => (
                          <a key={m.src} href={m.src} target="_blank" rel="noopener noreferrer">
                            <img src={m.src} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, border: "1px solid var(--pp-paper-edge)" }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <StatusButtons slug={party.slug} status={party.status} ready={party.stage === "ready"} />
      </section>

      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.78rem" }}>
          Guest designs ({designs.length})
        </h2>
        {designs.length === 0 ? (
          <p className="pp-soft">None yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.75rem" }}>
            {designs.map((d) => (
              <figure key={d.designId} style={{ margin: 0 }}>
                <div className="checker" style={{ aspectRatio: "1", borderRadius: 6, overflow: "hidden", border: "1px solid var(--pp-paper-edge)" }}>
                  {d.url && <img src={d.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                </div>
                <figcaption style={{ fontSize: "0.8rem", marginTop: 4 }}>{d.guestName}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
