import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { listPartySummaries, STAGE_LABEL, type FulfilmentStatus } from "@/lib/admin-data";
import { TestEmail } from "./TestEmail";

type Props = { searchParams: Promise<{ stage?: string; q?: string }> };

const STAGE_COLOR: Record<FulfilmentStatus, string> = {
  collecting: "#e2ebdb",
  designing: "#f7e5a6",
  ready: "#f6c9a8",
  printing: "#dfe8f1",
  shipped: "#eeeeee",
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function AdminHome({ searchParams }: Props) {
  if (!(await isAdmin())) return null; // the layout shows the sign-in form
  const { stage, q } = await searchParams;
  const all = await listPartySummaries();

  const query = (q ?? "").trim().toLowerCase();
  const parties = all.filter(
    (p) =>
      (!stage || p.stage === stage) &&
      (!query ||
        [p.guestOfHonorName, p.hostEmail, p.hostName ?? "", p.slug].some((v) => v.toLowerCase().includes(query))),
  );
  const counts = Object.fromEntries(
    (Object.keys(STAGE_LABEL) as FulfilmentStatus[]).map((s) => [s, all.filter((p) => p.stage === s).length]),
  ) as Record<FulfilmentStatus, number>;

  const chip = (key: string | undefined, label: string, n: number) => {
    const active = (stage ?? "") === (key ?? "");
    const href = `/admin?${new URLSearchParams({ ...(key ? { stage: key } : {}), ...(q ? { q } : {}) }).toString()}`;
    return (
      <Link
        key={label}
        href={href}
        className="pp-caps"
        style={{
          fontSize: "0.68rem",
          padding: "0.45rem 0.8rem",
          borderRadius: 999,
          border: "1px solid var(--pp-paper-edge)",
          background: active ? "var(--pp-accent)" : "#fff",
          color: active ? "var(--pp-paper)" : "var(--pp-ink-soft)",
          textDecoration: "none",
        }}
      >
        {label} ({n})
      </Link>
    );
  };

  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <h1 className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)" }}>
          Parties
        </h1>
        <form style={{ display: "flex", gap: "0.5rem" }}>
          {stage && <input type="hidden" name="stage" value={stage} />}
          <input name="q" defaultValue={q} placeholder="Search name, email or code" className="pp-field" style={{ minWidth: 240 }} />
          <button className="pp-btn pp-btn-ghost" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }}>
            Search
          </button>
        </form>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0 1.25rem" }}>
        {chip(undefined, "All", all.length)}
        {(Object.keys(STAGE_LABEL) as FulfilmentStatus[]).map((s) => chip(s, STAGE_LABEL[s], counts[s]))}
      </div>

      {counts.ready > 0 && !stage && (
        <p className="pp-note" style={{ marginBottom: "1rem" }}>
          <strong>{counts.ready}</strong> {counts.ready === 1 ? "gift is" : "gifts are"} ready to print.{" "}
          <Link href="/admin?stage=ready" className="pp-link">
            Review them
          </Link>
        </p>
      )}

      {parties.length === 0 ? (
        <p className="pp-soft">No parties match.</p>
      ) : (
        <div className="pp-paper" style={{ borderRadius: 8, overflowX: "auto" }}>
          <table className="pp-board-table" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ paddingTop: "0.8rem" }}>Party</th>
                <th>Host</th>
                <th>Gift</th>
                <th>Deadline</th>
                <th>Designs</th>
                <th>Photos · Notes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/parties/${p.slug}`} className="pp-link" style={{ fontWeight: 600 }}>
                      {p.guestOfHonorName}
                    </Link>
                    <div className="pp-soft" style={{ fontSize: "0.82rem" }}>
                      {p.occasion} · {p.slug}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.92rem" }}>
                    {p.hostName ?? "—"}
                    <div className="pp-soft" style={{ fontSize: "0.82rem" }}>
                      {p.hostEmail}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>
                    {p.products.map((x) => (
                      <div key={x.key}>
                        {x.name} {x.final ? "✓" : ""}
                      </div>
                    ))}
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>{fmt(p.deadline)}</td>
                  <td style={{ fontSize: "0.9rem" }}>
                    {p.counts.designs} / {p.counts.guests}
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>
                    {p.counts.photos} · {p.counts.notes}
                  </td>
                  <td>
                    <span
                      className="pp-caps"
                      style={{ fontSize: "0.62rem", padding: "0.3rem 0.6rem", borderRadius: 999, background: STAGE_COLOR[p.stage], whiteSpace: "nowrap" }}
                    >
                      {STAGE_LABEL[p.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "2rem", borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem" }}>
        <TestEmail from={process.env.EMAIL_FROM ?? null} />
      </div>
    </main>
  );
}
