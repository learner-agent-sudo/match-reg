# Tournament Hub

A soccer tournament registration and management site. It is a static website
(hosted free on GitHub Pages) that talks directly to a Supabase database.

## Features

- **Team registration**: coaches / team managers sign up and register a team (with optional logo)
- **Player invite links**: coaches share a link; players join the team through it
- **Roles**: admin, coach, team manager, player
- **Payment tracking**: teams upload a payment screenshot; admin confirms
- **Resource planning**: pitches with date/time slots, referees, runners
- **Match scheduling**: round-robin groups, standings, playoff brackets, auto-schedule with pinning

## Setting up a new copy (no coding needed)

### 1. Supabase (the database)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run `supabase/reset.sql`.
   Optionally also run `supabase/seed.sql` to load demo data.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email".
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. GitHub (the website)

1. Fork or copy this repository.
2. **Settings → Pages** → Source: **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables tab** → add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
4. **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.
   After that, every push deploys automatically (takes 1–2 minutes).

Your site will be at `https://<your-github-name>.github.io/<repo-name>/`.

### 3. Back in Supabase

**Authentication → URL Configuration** → set **Site URL** to your site address from step 2.

### 4. First login

Open the site and click **Register Your Team**. The **very first account** created
becomes the admin automatically. Everyone after that is a coach, team manager or player.

The anon key is designed to be public: it is visible to anyone who opens the
site. What protects the data is the database rules in `supabase/hardening.sql`
(included in `reset.sql`): teams can only be created or joined through checked
database functions, only admins confirm payments, people only see their own
team's details, and each team can only touch its own uploaded files.

## Test Tools (admin → Test Tools tab)

One-click demo data so you don't have to type everything in by hand:

- **Load demo tournament**: 4–8 teams, each with a coach, team manager and players
  (all can sign in, password `demo1234`), pitches, time slots, referees, runners,
  a group and its round-robin matches
- **Fill group scores / Fill playoff scores / Clear all scores**: simulate results
- **Sign in as**: see the site as any demo coach, manager or player
- **Delete demo data**: removes the demo tournament and demo logins only

Delete the demo data before the real tournament goes live.

## User flows

- **Coach / manager**: Register Your Team → sign up → register team → copy invite link from the dashboard
- **Player**: open the invite link (`.../team/join/?code=...`) → fill in details → joined
- **Admin**: Tournaments, Teams (payment status), Pitches, Referees, Runners, Matches tabs

## Running locally (optional, for developers)

```bash
cp .env.local.example .env.local   # fill in the Supabase URL and anon key
npm install
npm run dev
```

## Database scripts

| File | Use |
|------|-----|
| `supabase/reset.sql` | Wipes and rebuilds all tables. Safe to run repeatedly. |
| `supabase/seed.sql` | Demo tournament, 4 teams, pitches, referees, runners, group matches. |
| `supabase/hardening.sql` | Security rules (who can see/change what, upload limits). Already inside reset.sql; run on its own for older databases. |
| `supabase/test-tools.sql` | Test Tools functions only, for databases created before they existed. |
| `supabase/security-fix.sql` | Role protection only, for databases created before it existed. |
| `supabase/schema.sql` | Same structure as `reset.sql`, for a brand-new empty project. |

## Tech

Next.js (static export) · Supabase (Postgres, Auth, Storage) · Tailwind CSS · GitHub Pages
