import Link from "next/link";
import { redirect } from "next/navigation";
import { brandFontVars } from "@/lib/brand-fonts";
import "./brand.css";

/** "Find your party": the Moody Celebrations front door. Guests usually arrive by link or QR code instead. */
export default function Home() {
  async function findParty(formData: FormData) {
    "use server";
    const raw = String(formData.get("code") ?? "").trim();
    // Accept a bare code ("harper-shower") or a pasted link ("…/p/harper-shower").
    const slug = raw.split("/p/").pop()?.split(/[/?#]/)[0]?.toLowerCase() ?? "";
    if (slug) redirect(`/p/${encodeURIComponent(slug)}`);
  }

  return (
    <div className={`mc ${brandFontVars}`}>
      <main className="mc-main">
        <header className="mc-logo">
          <span className="mc-icon mc-sparkle" aria-hidden="true" />
          <img src="/brand/wordmark-black.png" alt="Moody Celebrations" width={683} height={244} />
          <span className="mc-icon mc-sparkle" aria-hidden="true" />
        </header>

        <div className="mc-stage">

          <form action={findParty} className="mc-card">
            <h1 className="mc-script">Find your party</h1>
            <p className="mc-lead">Enter the party code from your invitation, or paste the link you were sent.</p>
            <label htmlFor="code" className="mc-label">
              Party code or link
            </label>
            <input id="code" name="code" required autoCapitalize="none" autoCorrect="off" placeholder="harper-shower" className="mc-input" />
            <button className="mc-button">Let&apos;s party</button>
          </form>
        </div>

        <footer className="mc-foot">
          <p className="mc-script mc-tag">Celebrate from anywhere</p>
          <p className="mc-host">
            Hosting a party? <Link href="/host/login">Open your dashboard</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
