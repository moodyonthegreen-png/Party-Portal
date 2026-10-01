"use client";

import { useActionState, useState, useTransition } from "react";
import { newHostLink, setStatus, updatePartyAdmin, type AdminState } from "../../actions";

export function HostLinkTools({ slug, canEmail }: { slug: string; canEmail: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AdminState | null>(null);
  const [copied, setCopied] = useState(false);

  const run = (email: boolean) => {
    if (!window.confirm("Make a new host link? The host's current link will stop working.")) return;
    setCopied(false);
    start(async () => setRes(await newHostLink(slug, email)));
  };

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {canEmail && (
          <button type="button" className="pp-btn" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending} onClick={() => run(true)}>
            Email a new link to the host
          </button>
        )}
        <button type="button" className="pp-btn pp-btn-ghost" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending} onClick={() => run(false)}>
          Make a new link to copy
        </button>
      </div>
      {res?.error && <p style={{ color: "var(--pp-leather)" }}>{res.error}</p>}
      {res?.message && <p style={{ color: "var(--pp-accent)", fontSize: "0.92rem" }}>{res.message}</p>}
      {res?.hostUrl && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ fontSize: "0.78rem", wordBreak: "break-all", background: "#fff", padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px dashed var(--pp-paper-edge)" }}>
            {res.hostUrl}
          </code>
          <button
            type="button"
            className="pp-link"
            onClick={async () => {
              await navigator.clipboard.writeText(res.hostUrl!);
              setCopied(true);
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <p className="pp-soft" style={{ fontSize: "0.82rem" }}>
        Opening a host link also signs you in to that party&apos;s dashboard on your device, which is handy for helping a host.
      </p>
    </div>
  );
}

export function StatusButtons({ slug, status, ready }: { slug: string; status: string; ready: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const go = (s: "collecting" | "printing" | "shipped", confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    start(async () => {
      const r = await setStatus(slug, s);
      setErr(r.error ?? null);
    });
  };
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem" }}>
      {status !== "printing" && status !== "shipped" && (
        <button type="button" className="pp-btn" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending || !ready} onClick={() => go("printing", "Mark as sent to print?")}>
          Mark as sent to print
        </button>
      )}
      {status === "printing" && (
        <button type="button" className="pp-btn" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending} onClick={() => go("shipped", "Mark as shipped?")}>
          Mark as shipped
        </button>
      )}
      {(status === "printing" || status === "shipped") && (
        <button type="button" className="pp-btn pp-btn-ghost" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending} onClick={() => go("collecting", "Move this party back to in progress?")}>
          Move back to in progress
        </button>
      )}
      {!ready && status !== "printing" && status !== "shipped" && (
        <span className="pp-soft" style={{ fontSize: "0.85rem" }}>
          Available once every gift is finalized.
        </span>
      )}
      {err && <span style={{ color: "var(--pp-leather)" }}>{err}</span>}
    </div>
  );
}

export function PartyEditForm({
  slug,
  hostEmail,
  hostName,
  giftProduct,
  extras,
  products,
}: {
  slug: string;
  hostEmail: string;
  hostName: string;
  giftProduct: string;
  extras: string[];
  products: { key: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(updatePartyAdmin.bind(null, slug), {});
  const label: React.CSSProperties = { fontSize: "0.7rem", display: "block", marginBottom: "0.3rem" };
  return (
    <form action={action} style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <label className="pp-caps" style={label} htmlFor="he">Host email</label>
        <input id="he" name="host_email" className="pp-field" defaultValue={hostEmail} />
      </div>
      <div>
        <label className="pp-caps" style={label} htmlFor="hn">Host name</label>
        <input id="hn" name="host_name" className="pp-field" defaultValue={hostName} />
      </div>
      <div>
        <label className="pp-caps" style={label} htmlFor="gp">Gift in the package</label>
        <select id="gp" name="gift_product" className="pp-field" defaultValue={giftProduct}>
          {products.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset style={{ border: 0, padding: 0 }}>
        <legend className="pp-caps" style={label}>Extra gifts bought</legend>
        {products.map((p) => (
          <label key={p.key} style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.95rem" }}>
            <input type="checkbox" name="extra_products" value={p.key} defaultChecked={extras.includes(p.key)} style={{ accentColor: "var(--pp-accent)" }} />
            {p.name}
          </label>
        ))}
      </fieldset>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <button className="pp-btn" style={{ fontSize: "0.75rem", padding: "0.6rem 1rem" }} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error && <span style={{ color: "var(--pp-leather)" }}>{state.error}</span>}
        {state.message && <span style={{ color: "var(--pp-accent)" }}>{state.message}</span>}
      </div>
    </form>
  );
}
