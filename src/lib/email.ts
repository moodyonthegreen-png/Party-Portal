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
  const sans = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";
  const button = opts.button
    ? `<tr><td align="center" style="padding:10px 32px 30px">
         <a href="${esc(opts.button.url)}" style="display:inline-block;background:#56704f;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-family:${sans};font-size:16px;font-weight:600">${esc(opts.button.label)}</a>
       </td></tr>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;background:#f1f3ec;padding:28px 12px;font-family:${sans};color:#253026">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fffefb;border:1px solid #e2e6da;border-radius:14px;overflow:hidden">
<tr><td style="background:#9aae91;padding:22px 32px;text-align:center;font-family:${serif};font-size:20px;color:#fbfaf3">Elebrate
  <div style="width:56px;height:1px;background:#e2c67a;margin:10px auto 0;font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td style="padding:30px 32px 6px;text-align:center">
  <h1 style="margin:0;font-family:${serif};font-weight:normal;font-size:30px;line-height:1.15;color:#253026">${esc(opts.heading)}</h1>
</td></tr>
<tr><td style="padding:12px 32px 8px;font-size:16px;line-height:1.6;color:#3a4639">${opts.body}</td></tr>
${button}
${opts.footer ? `<tr><td style="padding:0 32px 28px;font-size:13px;line-height:1.55;color:#5d695b">${opts.footer}</td></tr>` : ""}
</table>
<p style="margin:18px 0 0;font-size:12px;color:#7a8578;font-family:${sans}">Sent by Elebrate from Moody Celebrations</p>
</td></tr></table></body></html>`;
}

export function hostLinkEmail(opts: { to: string; parties: { guestOfHonorName: string; occasion: string; url: string }[] }): Email {
  const one = opts.parties.length === 1;
  const first = opts.parties[0];
  const list = opts.parties
    .map((p) => `<li style="margin:6px 0"><a href="${esc(p.url)}" style="color:#56704f">${esc(p.guestOfHonorName)}'s ${esc(p.occasion.toLowerCase())}</a></li>`)
    .join("");
  return {
    to: opts.to,
    subject: one ? `Your host link for ${first.guestOfHonorName}'s ${first.occasion.toLowerCase()}` : "Your Elebrate host links",
    html: layout({
      preheader: "Open your host dashboard",
      heading: "Your host dashboard",
      body: one
        ? `<p>Here's your private link to manage <strong>${esc(first.guestOfHonorName)}'s ${esc(first.occasion.toLowerCase())}</strong>. Opening it signs you in on that device.</p>`
        : `<p>Here are your private links. Opening one signs you in on that device.</p><ul>${list}</ul>`,
      button: one ? { label: "Open my dashboard", url: first.url } : undefined,
      footer:
        "Keep this email private: anyone with the link can manage the party. Asking for a new link switches off your old one. If you didn't ask for this, you can ignore it.",
    }),
    text: `Your host link${one ? "" : "s"}:\n${opts.parties.map((p) => `${p.guestOfHonorName}'s ${p.occasion.toLowerCase()}: ${p.url}`).join("\n")}\n\nKeep this private: anyone with the link can manage your party.`,
  };
}

export function coHostInviteEmail(opts: {
  to: string;
  name: string;
  invitedBy: string;
  guestOfHonorName: string;
  occasion: string;
  isGuestOfHonor: boolean;
  url: string;
  replyTo?: string;
}): Email {
  const party = `${opts.guestOfHonorName}'s ${opts.occasion.toLowerCase()}`;
  const intro = opts.isGuestOfHonor
    ? `<p>${esc(opts.invitedBy)} has set up a party page for your ${esc(opts.occasion.toLowerCase())}, and now you can see everything too: every note, voice memo and video in the guest book, the photo album, the games, and the designs for your gift.</p>
       <p>You can also send thank-you cards to everyone who celebrated you, right from your dashboard.</p>`
    : `<p>${esc(opts.invitedBy)} added you as a co-host for <strong>${esc(party)}</strong>. Your dashboard has the guest list, guest book, photos, games, gift designer and thank-yous.</p>`;
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.isGuestOfHonor ? `Your ${opts.occasion.toLowerCase()} party page is ready for you` : `You're a co-host for ${party}`,
    html: layout({
      preheader: opts.isGuestOfHonor ? "See everything your guests have shared" : "Open your co-host dashboard",
      heading: opts.isGuestOfHonor ? `For you, ${opts.name.split(" ")[0]}` : "You're a co-host!",
      body: `<p>Hi ${esc(opts.name)},</p>${intro}`,
      button: { label: "Open my dashboard", url: opts.url },
      footer:
        "This link is just for you: opening it signs you in on that device, and anyone with it can manage the party, so please don't forward it. If you lose it, use \"Email me my link\" on the sign-in page.",
    }),
    text: `Hi ${opts.name},\n\n${opts.invitedBy} gave you access to the dashboard for ${party}. Open it here: ${opts.url}\n\nThis link is just for you, so please don't forward it.`,
  };
}

export function revealEmail(opts: {
  to: string;
  guestOfHonorName: string;
  occasion: string;
  fromName: string;
  peopleCount: number;
  url: string;
  replyTo?: string;
}): Email {
  const first = opts.guestOfHonorName.split(" ")[0];
  const who = opts.peopleCount > 1 ? `${opts.peopleCount} people` : "The people who love you";
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `${first}, your ${opts.occasion.toLowerCase()} keepsake is ready`,
    html: layout({
      preheader: "Everything everyone shared, all in one place",
      heading: `For you, ${first}`,
      body: `<p style="text-align:center">${esc(who)} celebrated you, and every note, voice memo, video, photo and design they shared is waiting for you in one keepsake.</p>
        <p style="text-align:center">Find a cozy spot, maybe a tissue or two, and tap through whenever you're ready. You can watch it as many times as you like.</p>`,
      button: { label: "Open my keepsake", url: opts.url },
      footer: `Sent with love by ${esc(opts.fromName)} through Elebrate. This link is just for you.`,
    }),
    text: `${first}, ${who.toLowerCase()} celebrated you. Everything they shared is in your keepsake: ${opts.url}\n\nWith love, ${opts.fromName}`,
  };
}

/** Escape text, keep line breaks, and turn plain https links into links. */
function richText(s: string) {
  return esc(s.trim())
    .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#56704f">${u}</a>`)
    .replace(/\n/g, "<br>");
}

export function raffleWinnerEmail(opts: {
  to: string;
  name: string;
  prize: string;
  /** What they won: "the raffle" (default) or a game, e.g. "Guess the baby photo" */
  contest?: string;
  guestOfHonorName: string;
  occasion: string;
  details: string;
  fromName: string;
  replyTo?: string;
}): Email {
  const party = `${opts.guestOfHonorName}'s ${opts.occasion.toLowerCase()}`;
  const contest = opts.contest ?? "the raffle";
  const how = opts.contest ? `You won ${esc(contest)} at <strong>${esc(party)}</strong>! Your prize:` : `Your name was drawn in the raffle at <strong>${esc(party)}</strong>. You won:`;
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `You won ${contest} at ${party}!`,
    html: layout({
      preheader: `You won: ${opts.prize}`,
      heading: "You won!",
      body: `<p style="text-align:center">Hi ${esc(opts.name)},</p>
        <p style="text-align:center">${how}</p>
        <p style="text-align:center;font-size:22px;color:#56704f;margin:18px 0">${esc(opts.prize)}</p>
        ${opts.details.trim() ? `<div style="background:#f6f2df;border-radius:10px;padding:14px 16px;margin:8px 0 14px">${richText(opts.details)}</div>` : ""}
        <p style="text-align:center">Thank you for celebrating with us!<br>${esc(opts.fromName)}</p>`,
    }),
    text: `Hi ${opts.name},\n\nYou won ${contest} at ${party}: ${opts.prize}\n\n${opts.details.trim()}\n\nThank you for celebrating with us!\n${opts.fromName}`,
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

export function thankYouCardEmail(opts: { to: string; recipientName: string; fromName: string; guestOfHonorName: string; url: string; replyTo?: string; wins?: string[] }): Email {
  const wins = (opts.wins ?? []).filter(Boolean);
  const winLine = wins.length ? `<p style="text-align:center">And a little good news: you won ${wins.map(esc).join(" and ")}! The details are in your card.</p>` : "";
  return {
    to: opts.to,
    replyTo: opts.replyTo,
    subject: `A thank-you card for you from ${opts.fromName}`,
    html: layout({
      preheader: "Tap to open your card",
      heading: "You've got a card!",
      body: `<p style="text-align:center">Hi ${esc(opts.recipientName)},</p>
        <p style="text-align:center">${esc(opts.fromName)} sent you a little thank-you card for celebrating <strong>${esc(opts.guestOfHonorName)}</strong>.</p>${winLine}`,
      button: { label: "Open your card", url: opts.url },
    }),
    text: `Hi ${opts.recipientName},\n\n${opts.fromName} sent you a thank-you card for celebrating ${opts.guestOfHonorName}.${wins.length ? ` And good news: you won ${wins.join(" and ")}!` : ""} Open it here: ${opts.url}`,
  };
}
