import { redirect } from "next/navigation";
import { Ornament } from "@/components/Icon";
import "@/app/party.css";

/** "Find My Party" landing. Guests usually arrive by link or QR code instead. */
export default function Home() {
  async function findParty(formData: FormData) {
    "use server";
    const raw = String(formData.get("code") ?? "").trim();
    // Accept a bare code ("harper-shower") or a pasted link ("…/p/harper-shower").
    const slug = raw.split("/p/").pop()?.split(/[/?#]/)[0]?.toLowerCase() ?? "";
    if (slug) redirect(`/p/${encodeURIComponent(slug)}`);
  }

  return (
    <div data-theme="classic" className="pp-page">
      <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center", maxWidth: "28rem" }}>
        <section className="pp-cover" style={{ minHeight: 0, padding: "2.5rem 1.5rem 2.25rem" }}>
          <Ornament />
          <h1 className="pp-cover-name pp-foil" style={{ fontSize: "clamp(2.8rem, 12vw, 3.6rem)", maxWidth: "10ch" }}>
            Moody Celebrations
          </h1>
          <p className="pp-cover-sub">Celebrate from anywhere</p>
        </section>
        <form action={findParty} className="pp-paper" style={{ marginTop: "1rem", padding: "1.5rem 1.25rem", display: "grid", gap: "0.75rem" }}>
          <h2 className="pp-display" style={{ fontSize: "1.9rem" }}>
            Find your party
          </h2>
          <p className="pp-soft" style={{ fontSize: "0.95rem", marginTop: "-0.25rem" }}>
            Enter the party code from your invitation, or paste the link you were sent.
          </p>
          <label htmlFor="code" className="pp-caps" style={{ marginTop: "0.25rem" }}>
            Party code or link
          </label>
          <input id="code" name="code" required autoCapitalize="none" autoCorrect="off" placeholder="harper-shower" className="pp-field" />
          <button className="pp-btn">Go to the party</button>
        </form>
      </main>
    </div>
  );
}
