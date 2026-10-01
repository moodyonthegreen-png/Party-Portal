"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createParty, type AdminState } from "../actions";

const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export function NewPartyForm({ products, canEmail }: { products: { key: string; name: string }[]; canEmail: boolean }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(createParty, {});
  const [deadline, setDeadline] = useState("");
  const [eventDate, setEventDate] = useState("");
  const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };

  if (state.ok && state.slug) {
    return (
      <div className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 8, display: "grid", gap: "0.75rem" }}>
        <p style={{ color: "var(--pp-accent)", fontWeight: 600 }}>{state.message}</p>
        <p>
          Guest link: <code>/p/{state.slug}</code>
        </p>
        {state.hostUrl && (
          <p style={{ fontSize: "0.9rem" }}>
            Host link (private): <code style={{ wordBreak: "break-all" }}>{state.hostUrl}</code>
          </p>
        )}
        <Link href={`/admin/parties/${state.slug}`} className="pp-btn" style={{ justifySelf: "start" }}>
          Open the party
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="pp-paper" style={{ padding: "1.5rem 1.25rem", borderRadius: 8, display: "grid", gap: "1rem" }}>
      <div>
        <label className="pp-caps" style={label} htmlFor="n">Guest of honor&apos;s name</label>
        <input id="n" name="guest_of_honor_name" className="pp-field" required maxLength={80} />
      </div>
      <div>
        <label className="pp-caps" style={label} htmlFor="o">Occasion</label>
        <input id="o" name="occasion" className="pp-field" defaultValue="Baby shower" maxLength={60} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label className="pp-caps" style={label} htmlFor="he">Host email</label>
          <input id="he" name="host_email" type="email" className="pp-field" required />
        </div>
        <div>
          <label className="pp-caps" style={label} htmlFor="hn">Host name</label>
          <input id="hn" name="host_name" className="pp-field" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label className="pp-caps" style={label} htmlFor="ed">Party date</label>
          <input id="ed" type="datetime-local" className="pp-field" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <input type="hidden" name="event_date_iso" value={toIso(eventDate)} />
        </div>
        <div>
          <label className="pp-caps" style={label} htmlFor="dl">Design deadline</label>
          <input id="dl" type="datetime-local" className="pp-field" required value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <input type="hidden" name="deadline_iso" value={toIso(deadline)} />
        </div>
      </div>
      <div>
        <label className="pp-caps" style={label} htmlFor="gp">Gift product</label>
        <select id="gp" name="gift_product" className="pp-field" defaultValue="fleece-blanket">
          {products.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="pp-caps" style={label} htmlFor="s">Party code (optional)</label>
        <input id="s" name="slug" className="pp-field" placeholder="Made from the name if left blank" maxLength={40} />
      </div>
      {canEmail && (
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" name="send_email" defaultChecked style={{ accentColor: "var(--pp-accent)", width: 18, height: 18 }} />
          Email the host their link now
        </label>
      )}
      {state.error && <p style={{ color: "var(--pp-leather)" }}>{state.error}</p>}
      <button className="pp-btn" disabled={pending} style={{ justifySelf: "start" }}>
        {pending ? "Creating…" : "Create party"}
      </button>
    </form>
  );
}
