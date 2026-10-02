import Link from "next/link";
import { BrandShell } from "@/components/BrandShell";

export const metadata = { title: "Host link not valid", robots: { index: false, follow: false } };

export default function HostLinkExpired() {
  return (
    <BrandShell
      footer={
        <p className="mc-host">
          Looking for a party as a guest? <Link href="/">Find your party</Link>
        </p>
      }
    >
      <div className="mc-form">
        <h1 className="mc-script">That link didn&apos;t work</h1>
        <p className="mc-lead">
          Your host link may have been replaced with a newer one. Check your email for the latest link, or get a fresh one
          now.
        </p>
        <Link href="/host/login" className="mc-button">
          Email me my link
        </Link>
      </div>
    </BrandShell>
  );
}
