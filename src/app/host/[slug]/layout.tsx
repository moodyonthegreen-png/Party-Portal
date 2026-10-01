import type { Metadata } from "next";
import Link from "next/link";
import { themeFontVars } from "@/lib/fonts";
import { getHostParty } from "@/lib/host";
import { HostNav } from "./HostNav";
import "@/app/party.css";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Host dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HostLayout({ children, params }: Props) {
  const { slug } = await params;
  const party = await getHostParty(slug);

  return (
    // The host portal always uses the Moody Celebrations house look
    <div data-theme="classic" className={`pp-page ${themeFontVars}`}>
      {party ? (
        <>
          <header style={{ borderBottom: "1px solid var(--pp-paper-edge)", background: "rgb(255 253 246 / 0.85)" }}>
            <div className="pp-wrap pp-host-body" style={{ paddingTop: "1rem", paddingBottom: "0.75rem" }}>
              <p className="pp-caps pp-soft" style={{ fontSize: "0.7rem" }}>
                Host dashboard
              </p>
              <p className="pp-script" style={{ fontSize: "2.2rem", color: "var(--pp-accent)", marginTop: "0.2rem" }}>
                {party.guestOfHonorName}&apos;s {party.occasion.toLowerCase()}
              </p>
              <HostNav slug={party.slug} />
            </div>
          </header>
          <div className="pp-wrap pp-host-body">{children}</div>
        </>
      ) : (
        <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
          <div className="pp-paper" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
            <h1 className="pp-script" style={{ fontSize: "3rem", color: "var(--pp-accent)" }}>
              Hosts only
            </h1>
            <p style={{ marginTop: "1rem", lineHeight: 1.55 }}>
              To open your host dashboard, use the host link from your email. It signs you in on this device.
            </p>
            <p style={{ marginTop: "1.25rem" }}>
              <Link href="/host/login" className="pp-btn">
                Email me my link
              </Link>
            </p>
            <p style={{ marginTop: "1.25rem" }}>
              <Link href={`/p/${slug}`} className="pp-link">
                Go to the guest page instead
              </Link>
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
