"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { inviteCoHost, removeCoHost, resendCoHostLink, type CoHostState } from "../actions";

export type CoHostRow = {
  id: string;
  name: string;
  email: string;
  role: "guest_of_honor" | "helper";
  linkSentAt: string | null;
  lastOpenedAt: string | null;
};

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", borderRadius: 4, display: "grid", gap: "1.1rem" };
const small: React.CSSProperties = { fontSize: "0.8rem", padding: "0.6rem 0.95rem" };

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Result({ state }: { state: CoHostState | null }) {
  const [copied, setCopied] = useState(false);
  if (!state) return null;
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {state.error && (
        <p role="alert" style={{ color: "var(--pp-leather)" }}>
          {state.error}
        </p>
      )}
      {state.message && <p style={{ color: "var(--pp-accent)" }}>{state.message}</p>}
      {state.url && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="pp-btn pp-btn-ghost"
            style={small}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.url!);
              } catch {
                window.prompt("Copy their link:", state.url);
              }
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied!" : "Copy their link"}
          </button>
          <span className="pp-soft" style={{ fontSize: "0.85rem" }}>
            Only send it to them: anyone with it can manage the party.
          </span>
        </div>
      )}
    </div>
  );
}

export function CoHosts({
  slug,
  guestOfHonorName,
  coHosts,
  isHost,
  ready,
}: {
  slug: string;
  guestOfHonorName: string;
  coHosts: CoHostRow[];
  /** Only the host can remove co-hosts */
  isHost: boolean;
  /** False until the co_hosts table exists */
  ready: boolean;
}) {
  const [state, action, pending] = useActionState<CoHostState, FormData>(inviteCoHost.bind(null, slug), {});
  const formRef = useRef<HTMLFormElement>(null);
  const hasGoh = coHosts.some((c) => c.role === "guest_of_honor");
  const [role, setRole] = useState<"guest_of_honor" | "helper">(hasGoh ? "helper" : "guest_of_honor");
  const [rowResult, setRowResult] = useState<CoHostState | null>(null);
  const [rowPending, start] = useTransition();

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    setRole(hasGoh ? "helper" : "guest_of_honor");
  }, [hasGoh]);

  const first = guestOfHonorName.split(" ")[0];

  return (
    <section className="pp-paper" style={card} id="co-hosts">
      <div>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Co-hosts
        </h2>
        <p className="pp-soft" style={{ fontSize: "1rem", marginTop: "0.4rem" }}>
          Give {first} (or a helper) their own private link to this dashboard. They can see and do everything you can,
          including sending thank-you cards, which will be signed with their name.
        </p>
      </div>

      {!ready ? (
        <p className="pp-note" style={{ fontSize: "0.95rem" }}>
          Co-hosts aren&apos;t switched on yet. Moody Celebrations needs to run one quick database update first.
        </p>
      ) : (
        <>
          {coHosts.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, opacity: rowPending ? 0.6 : 1 }}>
              {coHosts.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: "0.75rem 0",
                    borderTop: "1px solid var(--pp-paper-edge)",
                  }}
                >
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <p style={{ fontWeight: 500 }}>
                      {c.name}{" "}
                      <span className="pp-caps pp-soft" style={{ fontSize: "0.62rem", marginLeft: "0.3rem" }}>
                        {c.role === "guest_of_honor" ? "Guest of honor" : "Helper"}
                      </span>
                    </p>
                    <p className="pp-soft" style={{ fontSize: "0.85rem", overflowWrap: "anywhere" }}>
                      {c.email}
                      {c.lastOpenedAt
                        ? ` · last signed in ${shortDate(c.lastOpenedAt)}`
                        : c.linkSentAt
                          ? ` · invited ${shortDate(c.linkSentAt)}, hasn't opened it yet`
                          : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="pp-btn pp-btn-ghost"
                    style={small}
                    disabled={rowPending}
                    onClick={() => {
                      if (!window.confirm(`Send ${c.name.split(" ")[0]} a fresh link? Their old link will stop working.`)) return;
                      start(async () => setRowResult(await resendCoHostLink(slug, c.id)));
                    }}
                  >
                    Email their link again
                  </button>
                  {isHost && (
                    <button
                      type="button"
                      className="pp-link"
                      style={{ background: "none", border: 0, font: "inherit", fontSize: "0.9rem", color: "var(--pp-leather)", cursor: "pointer" }}
                      disabled={rowPending}
                      onClick={() => {
                        if (!window.confirm(`Remove ${c.name}? Their link will stop working right away.`)) return;
                        start(async () => setRowResult(await removeCoHost(slug, c.id)));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Result state={rowResult} />

          <form ref={formRef} action={action} style={{ display: "grid", gap: "0.75rem", borderTop: "1px solid var(--pp-paper-edge)", paddingTop: "1rem" }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
              <legend className="pp-caps" style={{ fontSize: "0.72rem", marginBottom: "0.5rem" }}>
                Invite
              </legend>
              <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input type="radio" name="role" value="guest_of_honor" checked={role === "guest_of_honor"} onChange={() => setRole("guest_of_honor")} />
                {first}, the guest of honor
              </label>
              <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input type="radio" name="role" value="helper" checked={role === "helper"} onChange={() => setRole("helper")} />A helper
              </label>
            </fieldset>
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <label htmlFor="co_name" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
                  Name
                </label>
                <input
                  id="co_name"
                  name="name"
                  className="pp-field"
                  maxLength={80}
                  required
                  key={role}
                  defaultValue={role === "guest_of_honor" ? guestOfHonorName : ""}
                />
              </div>
              <div>
                <label htmlFor="co_email" className="pp-caps" style={{ fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" }}>
                  Email
                </label>
                <input id="co_email" name="email" type="email" className="pp-field" maxLength={200} required autoComplete="off" />
              </div>
            </div>
            <div>
              <button className="pp-btn" disabled={pending} style={small}>
                {pending ? "Sending…" : role === "guest_of_honor" ? `Invite ${first}` : "Invite helper"}
              </button>
            </div>
            <p className="pp-soft" style={{ fontSize: "0.85rem" }}>
              Keeping something a surprise? Wait to invite {first} until after the party. Everything will still be here.
            </p>
            <Result state={state.error || state.message ? state : null} />
          </form>
        </>
      )}
    </section>
  );
}
