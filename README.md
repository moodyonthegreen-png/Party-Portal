# Moody Celebrations Party Portal

The party portal that lives on a subdomain of moodycelebrations.com. Every
party package bought on Shopify gets its own guest site and host portal here.

**Stack:** Next.js (App Router) on Vercel, Supabase for the database and photo
storage, Tailwind CSS.

## What's built so far

- **Find My Party** (`/`): enter a party code or paste a link.
- **Guest site welcome** (`/p/[code]`): who the party is for, the deadline,
  the three steps, and links to the other sections (shown as "coming soon").
- **Optional party password**: if a party has one, guests enter it once per
  browser.
- **Add My Design** (`/p/[code]/design`)
  - Pick a name from the host's guest list, or type one
  - Take or choose a photo of the drawing card, or draw on screen
  - Automatic cleanup in the browser: finds the card, drops the table around
    it, evens out shadows, removes the white paper, crops to the drawing
  - Warnings for blurry photos, very faint drawings, or no drawing found
  - Preview before submitting
  - Replace any time before the deadline, from the same phone or computer

Photo cleanup lives in `src/lib/image/drawing.ts` and has tests (`npm test`).

## Not built yet

Host portal (including editing the welcome message, tagline and registry link), photo album, message board, games, the group-gift designer, more themes,
Moody Celebrations admin view, and the Shopify and Printify connections.

## Setting it up

### 1. Supabase

1. Create a project at supabase.com.
2. Open **SQL Editor**, paste in `supabase/migrations/0001_init.sql`, and run it.
3. To try it with sample data, also run `supabase/seed.sql`. That creates a
   party at `/p/demo-shower`.
4. From **Project Settings → API**, note the project URL, the anon key, and the
   service-role key.

### 2. Vercel

1. Import this GitHub repo into Vercel.
2. Under **Settings → Environment Variables**, add the three values from
   `.env.example`.
3. Deploy. Later, point `party.moodycelebrations.com` (or whichever subdomain
   you choose) at it under **Settings → Domains**.

### 3. Running it on your own computer (optional)

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

## How it's put together

- Guests never have accounts. Every table has Row Level Security on with no
  public access, so the browser can't touch the database directly. All guest
  actions go through server code in `src/app/p/[slug]/**/actions.ts`, which
  checks the deadline, password and guest list itself.
- Photos go straight from the guest's browser to Supabase Storage using
  one-time signed upload links, so big phone photos aren't limited by Vercel's
  4.5 MB request cap. The server then checks the files arrived and records
  the design.
- Each browser gets a private random token per party. Designs are tied to the
  token of the browser that added them, so only that browser can replace them.
  One browser can add designs for several people (a parent adding for the
  kids).
- We keep both the cleaned PNG (for the group gift) and the original photo (so we
  can re-process at full quality later).
