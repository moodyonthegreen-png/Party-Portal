import { themeFontVars } from "@/lib/fonts";
import "@/app/party.css";

export const metadata = { title: "Host link not valid" };

export default function HostLinkExpired() {
  return (
    <div data-theme="classic" className={`pp-page ${themeFontVars}`}>
      <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
        <div className="pp-paper" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <h1 className="pp-script" style={{ fontSize: "3rem", color: "var(--pp-accent)" }}>
            That link didn&apos;t work
          </h1>
          <p style={{ marginTop: "1rem", lineHeight: 1.55 }}>
            Your host link may have been replaced with a newer one. Check your email for the latest link, or contact
            Moody Celebrations and we&apos;ll send you a fresh one.
          </p>
        </div>
      </main>
    </div>
  );
}
