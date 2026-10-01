import type { Metadata } from "next";
import Link from "next/link";
import { adminConfigured, isAdmin } from "@/lib/admin";
import { themeFontVars } from "@/lib/fonts";
import { AdminSignIn } from "./AdminSignIn";
import { adminSignOut } from "./auth-actions";
import "@/app/party.css";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return (
    <div data-theme="classic" className={`pp-page ${themeFontVars}`}>
      {admin ? (
        <>
          <header style={{ borderBottom: "1px solid var(--pp-paper-edge)", background: "rgb(255 253 246 / 0.85)" }}>
            <div className="pp-wrap" style={{ maxWidth: "72rem", paddingTop: "1rem", paddingBottom: "0.75rem", display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
              <Link href="/admin" className="pp-script" style={{ fontSize: "2rem", color: "var(--pp-accent)", textDecoration: "none" }}>
                Moody admin
              </Link>
              <Link href="/admin" className="pp-caps" style={{ fontSize: "0.75rem", color: "var(--pp-ink-soft)" }}>
                Parties
              </Link>
              <Link href="/admin/new" className="pp-caps" style={{ fontSize: "0.75rem", color: "var(--pp-ink-soft)" }}>
                New party
              </Link>
              <form action={adminSignOut} style={{ marginLeft: "auto" }}>
                <button className="pp-link" style={{ fontSize: "0.85rem" }}>
                  Sign out
                </button>
              </form>
            </div>
          </header>
          <div className="pp-wrap" style={{ maxWidth: "72rem" }}>
            {children}
          </div>
        </>
      ) : (
        <AdminSignIn configured={adminConfigured()} />
      )}
    </div>
  );
}
