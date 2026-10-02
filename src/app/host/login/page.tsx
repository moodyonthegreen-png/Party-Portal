import { themeFontVars } from "@/lib/fonts";
import { LoginForm } from "./LoginForm";
import "@/app/party.css";

export const metadata = { title: "Host sign-in", robots: { index: false, follow: false } };

export default function HostLogin() {
  return (
    <div data-theme="classic" className={`pp-page ${themeFontVars}`}>
      <main className="pp-wrap" style={{ minHeight: "100dvh", display: "grid", alignContent: "center" }}>
        <div className="pp-paper" style={{ padding: "2.5rem 1.5rem", transform: "rotate(-0.6deg)" }}>
          <div className="pp-tape" style={{ left: "50%", top: "-12px", transform: "translateX(-50%) rotate(-3deg)" }} />
          <p className="pp-caps pp-soft" style={{ fontSize: "0.75rem", textAlign: "center" }}>
            Moody Celebrations
          </p>
          <h1 className="pp-script" style={{ fontSize: "3rem", color: "var(--pp-accent)", textAlign: "center", margin: "0.4rem 0 0.8rem" }}>
            Host sign-in
          </h1>
          <p style={{ lineHeight: 1.55, textAlign: "center" }}>
            Enter the email you ordered with (or the one your host invited) and we&apos;ll send you a link to your dashboard. No password needed.
          </p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
