# Tournament Hub

A soccer tournament registration and management platform built with Next.js and Supabase.

## Features (Phase 1)

- **Team Registration**: Coaches/managers sign up and register their team
- **Player Invite Links**: Coaches share a unique link for players to join
- **Role Management**: Admin, Coach, Team Manager, Player roles
- **Payment Tracking**: Teams upload payment proof screenshots
- **Admin Dashboard**: View all teams, members, and manage payment status

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Settings > API** and copy your project URL and anon key

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Create the First Admin

After running the schema, manually insert an admin user:

1. Sign up through the app normally
2. In Supabase dashboard, go to **Table Editor > profiles**
3. Change the user's `role` to `admin`

### 4. Create a Tournament

In Supabase **Table Editor > tournaments**, insert a row:
- `name`: Your tournament name
- `registration_open`: true
- `max_teams`: 8 (or your limit)

### 5. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npx vercel
```

Or connect the repo to Vercel and it will auto-deploy. Set the environment variables in the Vercel dashboard.

## User Flows

### Coach/Manager Registration
1. Visit `/auth/signup` and select role (Coach or Team Manager)
2. After signup, register team at `/team/register`
3. From dashboard, copy invite link to share with players

### Player Registration
1. Receive invite link from coach (e.g., `/team/join/abc123`)
2. Fill in details (name, email, password, jersey number)
3. Automatically added to the team

### Admin
1. View all teams and their payment status at `/admin`
2. Click a team to see its members
3. Update payment status (pending -> submitted -> confirmed)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (payment proofs)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Upcoming Phases

- Phase 2: Resource planning (pitches, referees, runners)
- Phase 3: Match scheduling (group stage, playoffs, championship)
- Phase 4: Live results and standings
- Phase 5: Rules document management
