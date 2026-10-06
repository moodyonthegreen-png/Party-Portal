import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandShell } from "@/components/BrandShell";

/** "Find your party": the Elebrate front door. Guests usually arrive by link or QR code instead. */
export default function Home() {
  async function findParty(formData: FormData) {
    "use server";
    const raw = String(formData.get("code") ?? "").trim();
    // Accept a bare code ("harper-shower") or a pasted link ("…/p/harper-shower").
    const slug = raw.split("/p/").pop()?.split(/[/?#]/)[0]?.toLowerCase() ?? "";
    if (slug) redirect(`/p/${encodeURIComponent(slug)}`);
  }

  return (
    <BrandShell
      footer={
        <>
          <p className="mc-script mc-tag">Elebrate</p>
          <p className="mc-by">by Moody Celebrations</p>
          <p className="mc-host">
            Hosting a party? <Link href="/host/login">Open your dashboard</Link>
          </p>
        </>
      }
    >
      <form action={findParty} className="mc-form">
        <h1 className="mc-script">Find your party</h1>
        <p className="mc-lead">Enter the party code from your invitation, or paste the link you were sent.</p>
        <label htmlFor="code" className="mc-label">
          Party code or link
        </label>
        <input id="code" name="code" required autoCapitalize="none" autoCorrect="off" placeholder="harper-shower" className="mc-input" />
        <button className="mc-button">Let&apos;s party</button>
      </form>
    </BrandShell>
  );
}
