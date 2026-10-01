"use client";

import { useActionState, useEffect, useState } from "react";
import { defaultTagline, defaultWelcome } from "@/lib/copy";
import { setPartyPassword, updateDetails, type ActionState } from "../actions";

type Initial = {
  guestOfHonorName: string;
  occasion: string;
  tagline: string;
  welcomeMessage: string;
  eventDate: string | null;
  deadline: string;
  theme: string;
  sections: { design: boolean; album: boolean; messages: boolean; games: boolean };
  registryUrl: string;
  requireGuestList: boolean;
  hostName: string;
};

const OCCASIONS = ["Baby shower", "Sprinkle", "Sip and see", "Bridal shower", "Birthday", "Graduation", "Retirement"];

/** ISO -> value for <input type="datetime-local"> in the host's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local: string): string {
  return local ? new Date(local).toISOString() : "";
}

const card: React.CSSProperties = { padding: "1.5rem 1.25rem", borderRadius: 4, display: "grid", gap: "1.1rem" };
const label: React.CSSProperties = { fontSize: "0.72rem", display: "block", marginBottom: "0.35rem" };
const hint: React.CSSProperties = { fontSize: "0.88rem", marginTop: "0.3rem" };

function Field({ id, title, help, children }: { id: string; title: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="pp-caps" style={label}>
        {title}
      </label>
      {children}
      {help && (
        <p className="pp-soft" style={hint}>
          {help}
        </p>
      )}
    </div>
  );
}

function Status({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" style={{ color: "var(--pp-leather)" }}>
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" style={{ color: "var(--pp-accent)" }}>
        {state.message}
      </p>
    );
  return null;
}

export function SettingsForm({
  slug,
  themes,
  initial,
}: {
  slug: string;
  themes: { id: string; name: string }[];
  initial: Initial;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateDetails.bind(null, slug), {});
  const [name, setName] = useState(initial.guestOfHonorName);
  const [occasion, setOccasion] = useState(initial.occasion);
  const [theme, setTheme] = useState(initial.theme);
  const [eventLocal, setEventLocal] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [ready, setReady] = useState(false);

  // Dates are shown in the host's time zone, which is only known in the browser
  useEffect(() => {
    setEventLocal(toLocalInput(initial.eventDate));
    setDeadlineLocal(toLocalInput(initial.deadline));
    setReady(true);
  }, [initial.eventDate, initial.deadline]);

  const taglineDefault = defaultTagline(occasion);

  return (
    <form action={action} style={{ display: "grid", gap: "1.75rem" }}>
      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Who we&apos;re celebrating
        </h2>
        <Field id="guest_of_honor_name" title="Guest of honor's name">
          <input
            id="guest_of_honor_name"
            name="guest_of_honor_name"
            className="pp-field"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field id="occasion" title="Occasion">
          <input
            id="occasion"
            name="occasion"
            className="pp-field"
            list="occasions"
            maxLength={60}
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          />
          <datalist id="occasions">
            {OCCASIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Field>
        <Field
          id="tagline"
          title="Line under the name"
          help={taglineDefault ? `Leave blank to use “${taglineDefault}”.` : "Optional."}
        >
          <input
            id="tagline"
            name="tagline"
            className="pp-field"
            maxLength={120}
            defaultValue={initial.tagline}
            placeholder={taglineDefault ?? "e.g. The mom-to-be"}
          />
        </Field>
        <Field id="welcome_message" title="Welcome message" help="Shown on the welcome card. Leave blank to use the friendly default shown.">
          <textarea
            id="welcome_message"
            name="welcome_message"
            className="pp-field"
            rows={5}
            maxLength={1500}
            defaultValue={initial.welcomeMessage}
            placeholder={defaultWelcome(name || "them")}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
        </Field>
        <Field id="host_name" title="Your name" help="Optional. For your own records and future emails to guests.">
          <input id="host_name" name="host_name" className="pp-field" maxLength={80} defaultValue={initial.hostName} />
        </Field>
      </section>

      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Dates
        </h2>
        <Field id="event_date" title="Party date and time" help="Optional. Shown on the welcome card.">
          <input
            id="event_date"
            type="datetime-local"
            className="pp-field"
            value={eventLocal}
            onChange={(e) => setEventLocal(e.target.value)}
          />
          <input type="hidden" name="event_date_iso" value={toIso(eventLocal)} />
        </Field>
        <Field
          id="deadline"
          title="Design deadline"
          help="Guests can add or replace their design for the group gift until this time."
        >
          <input
            id="deadline"
            type="datetime-local"
            className="pp-field"
            required
            value={deadlineLocal}
            onChange={(e) => setDeadlineLocal(e.target.value)}
          />
          <input type="hidden" name="deadline_iso" value={toIso(deadlineLocal)} />
        </Field>
      </section>

      <section className="pp-paper" style={card}>
        <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
          Look and activities
        </h2>
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="pp-caps" style={label}>
            Theme
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" }}>
            {themes.map((t) => {
              const selected = theme === t.id;
              return (
                <label key={t.id} style={{ cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={selected}
                    onChange={() => setTheme(t.id)}
                    className="sr-only"
                  />
                  <div
                    data-theme={t.id}
                    className="pp-page"
                    style={{
                      minHeight: 0,
                      height: 92,
                      borderRadius: 10,
                      border: "1px solid var(--pp-paper-edge)",
                      outline: selected ? "3px solid #5d7a53" : "none",
                      outlineOffset: 3,
                      padding: 12,
                      display: "grid",
                      alignContent: "end",
                    }}
                  >
                    <div className="pp-paper" style={{ padding: "6px 8px", borderRadius: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 99, background: "var(--pp-accent)" }} />
                      <span style={{ width: 12, height: 12, borderRadius: 99, background: "var(--pp-gold)" }} />
                      <span style={{ width: 12, height: 12, borderRadius: 99, background: "var(--pp-swatch)" }} />
                    </div>
                  </div>
                  <span style={{ display: "block", marginTop: 8, fontSize: "0.95rem", fontWeight: selected ? 600 : 400 }}>
                    {t.name}
                    {selected ? " ✓" : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="pp-caps" style={label}>
            Activities on the guest page
          </legend>
          {(
            [
              ["section_design", "Add your design (for the group gift)", initial.sections.design],
              ["section_album", "Photo album", initial.sections.album],
              ["section_messages", "Message board", initial.sections.messages],
              ["section_games", "Games", initial.sections.games],
            ] as const
          ).map(([nameAttr, text, on]) => (
            <label key={nameAttr} style={{ display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.35rem 0" }}>
              <input type="checkbox" name={nameAttr} defaultChecked={on} style={{ width: 18, height: 18, accentColor: "var(--pp-accent)" }} />
              {text}
            </label>
          ))}
        </fieldset>

        <Field id="registry_url" title="Registry link" help="Optional. Shows a Registry button on the guest page.">
          <input
            id="registry_url"
            name="registry_url"
            className="pp-field"
            inputMode="url"
            maxLength={500}
            defaultValue={initial.registryUrl}
            placeholder="https://www.babylist.com/…"
          />
        </Field>

        <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
          <input
            type="checkbox"
            name="require_guest_list"
            defaultChecked={initial.requireGuestList}
            style={{ width: 18, height: 18, marginTop: 4, accentColor: "var(--pp-accent)" }}
          />
          <span>
            Only guests on my guest list can add a design
            <span className="pp-soft" style={{ display: "block", fontSize: "0.88rem" }}>
              Off by default, so anyone with the link can join in.
            </span>
          </span>
        </label>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button className="pp-btn" disabled={pending || !ready}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PasswordForm({ slug, hasPassword }: { slug: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setPartyPassword.bind(null, slug), {});

  return (
    <section className="pp-paper" style={card}>
      <h2 className="pp-caps" style={{ fontSize: "0.8rem" }}>
        Party password
      </h2>
      <p className="pp-soft" style={{ fontSize: "1rem" }}>
        {hasPassword
          ? "Guests are asked for a password once on each device. Passwords are stored securely, so we can't show the current one."
          : "Optional. Without a password, anyone with the link can join."}
      </p>
      <form action={action} style={{ display: "grid", gap: "0.75rem" }}>
        <Field id="password" title={hasPassword ? "New password" : "Password"}>
          <input id="password" name="password" className="pp-field" autoComplete="off" maxLength={60} />
        </Field>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="pp-btn" disabled={pending} style={{ fontSize: "0.8rem", padding: "0.7rem 1rem" }}>
            {hasPassword ? "Change password" : "Set password"}
          </button>
          {hasPassword && (
            <button
              name="remove"
              value="1"
              className="pp-btn pp-btn-ghost"
              disabled={pending}
              style={{ fontSize: "0.8rem", padding: "0.7rem 1rem" }}
            >
              Remove password
            </button>
          )}
        </div>
        <Status state={state} />
      </form>
    </section>
  );
}
