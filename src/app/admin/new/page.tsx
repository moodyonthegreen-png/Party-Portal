import { isAdmin } from "@/lib/admin";
import { emailConfigured } from "@/lib/email";
import { PRODUCTS } from "@/lib/gift/products";
import { NewPartyForm } from "./NewPartyForm";

export default async function NewParty() {
  if (!(await isAdmin())) return null;
  return (
    <main style={{ paddingTop: "1.5rem", paddingBottom: "3rem", maxWidth: "36rem" }}>
      <h1 className="pp-script" style={{ fontSize: "2.6rem", color: "var(--pp-accent)" }}>
        New party
      </h1>
      <p className="pp-soft" style={{ marginBottom: "1.25rem" }}>
        For orders taken outside the shop. Once Shopify is connected, parties are created automatically when someone buys.
      </p>
      <NewPartyForm products={Object.values(PRODUCTS).map((p) => ({ key: p.key, name: p.name }))} canEmail={emailConfigured()} />
    </main>
  );
}
