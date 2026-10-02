import "server-only";

/**
 * Sending email through Resend (resend.com). Needs RESEND_API_KEY and
 * EMAIL_FROM, e.g. "Moody Celebrations <party@moodycelebrations.com>".
 */

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Email = { to: string; subject: string; html: string; text: string; replyTo?: string };

export class EmailError extends Error {}

export async function sendEmails(emails: Email[]): Promise<number> {
  if (!emails.length) return 0;
  if (!emailConfigured()) throw new EmailError("Email isn't set up yet (RESEND_API_KEY and EMAIL_FROM).");
  let sent = 0;
  // Resend's batch endpoint takes up to 100 at a time
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100).map((e) => ({
      from: process.env.EMAIL_FROM,
      to: [e.to],
      subject: e.subject,
      html: e.html,
      text: e.text,
      ...(e.replyTo ? { reply_to: e.replyTo } : {}),
    }));
    const res = await fetch(chunk.length === 1 ? "https://api.resend.com/emails" : "https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.length === 1 ? chunk[0] : chunk),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}: ${body.slice(0, 500)}`);
      if (res.status === 403 || res.status === 401) {
        throw new EmailError("Resend didn't accept the request. Check the API key and that your domain is verified.");
      }
      throw new EmailError("The email service had a problem. Please try again in a minute.");
    }
    sent += chunk.length;
  }
  return sent;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(opts: { preheader: string; heading: string; body: string; button?: { label: string; url: string }; footer?: string }) {
  const button = opts.button
    ? `<tr><td align="center" style="padding:8px 0 24px">
         <a href="${esc(opts.button.url)}" style="display:inline-block;background:#5d7a53;color:#fffdf6;text-decoration:none;padding:14px 28px;border-radius:999px;font-family:Georgia,serif;font-size:15px;letter-spacing:1.5px;text-transform:uppercase">${esc(opts.button.label)}</a>
       </td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f2e6;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#3b4836">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf6;border:1px solid #ece6d2;border-radius:6px">
<tr><td style="height:8px;background:#e6be4f;border-radius:6px 6px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;text-align:center">
  <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#66735f">Moody Celebrations</p>
  <h1 style="margin:12px 0 0;font-size:28px;font-weight:normal;color:#5d7a53">${esc(opts.heading)}</h1>
</td></tr>
<tr><td style="padding:12px 28px 8px;font-size:17px;line-height:1.55">${opts.body}</td></tr>
${button}
${opts.footer ? `<tr><td style="padding:0 28px 24px;font-size:13px;line-height:1.5;color:#66735f">${opts.footer}</td></tr>` : ""}
</table>
</td></tr></table></body></html>`;
}

export function hostLinkEmail(opts: { to: string; parties: { guestOfHonorName: string; occasion: string; url: string }[] }): Email {
  const one = opts.parties.length === 1;
  const first = opts.parties[0];
  const list = opts.parties
    .map((p) => `<li style="margin:6px 0"><a href="${esc(p.url)}" style="color:#5d7a53">${esc(p.guestOfHonorName)}'s ${esc(p.occasion.toLowerCase())}</a></li>`)
    .join("");
  return {
    to: opts.to,
    subject: one ? `Your host link for ${first.guestOfHonorName}'s ${first.occasion.toLowerCase()}` : "Your Moody Celebrations host links",
    html: layout({
      preheader: "Open your host dashboard",
      heading: "Your host dashboard",
      body: one
        ? `<p>Here's your private link to manage <strong>${esc(first.guestOfHonorName)}'s ${esc(first.occasion.toLowerCase())}</strong>. Opening it signs you in on that device.</p>`
        : `<p>Here are your private links. Opening one signs you in on that device.</p><ul>${list}</ul>`,
      button: one ? { label: "Open my dashboard", url: first.url } : undefined,
      footer:
        "Keep this email private: anyone with the link can manage your party. Asking for a new link switches off the old one. If you didn't ask for this, you can ignore it.",
    }),
    text: `Your host link${one ? "" : "s"}:\n${opts.parties.map((p) => `${p.guestOfHonorName}'s ${p.occasion.toLowerCase()}: ${p.url}`).join("\n")}\n\nKeep this private: anyone with the link can manage your party.`,
  };
}

export function reminderEmail(opts: {
  to: string;
  guestName: string;
  guestOfHonorName: string;
  deadline: string;
  url: string;
  hostName: string | null;
  replyTo?: string;
}): Email {
  const when = new Date(opts.deadline).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const from = opts.hostName ? esc(opts.hostName) : "The host";
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `${opts.guestName.split(" ")[0]}, there's still time to add your design for ${opts.guestOfHonorName}`,
    html: layout({
      preheader: `Add your design by ${when}`,
      heading: `A little reminder`,
      body: `<p>Hi ${esc(opts.guestName)},</p>
        <p>${from} is making a one-of-a-kind gift for <strong>${esc(opts.guestOfHonorName)}</strong> from designs by everyone celebrating, and we'd love yours on it!</p>
        <p>Draw something on your card, snap a photo, and add it here by <strong>${esc(when)}</strong>. It only takes a minute.</p>`,
      button: { label: "Add my design", url: opts.url },
      footer: "You're getting this because the host added you to the guest list.",
    }),
    text: `Hi ${opts.guestName},\n\nThere's still time to add your design for ${opts.guestOfHonorName}'s gift, by ${when}: ${opts.url}`,
  };
}

export function thankYouEmail(opts: { to: string; message: string; fromName: string; replyTo?: string }): Email {
  const paragraphs = opts.message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `A thank-you from ${opts.fromName}`,
    html: layout({ preheader: "Thank you for celebrating with us", heading: "Thank you", body: paragraphs }),
    text: opts.message,
  };
}
