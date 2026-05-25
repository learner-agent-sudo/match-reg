-- Tournament Registration Platform Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tournaments table
create table public.tournaments (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  start_date date,
  end_date date,
  max_teams integer default 8,
  registration_open boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Teams table
create table public.teams (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  payment_status text default 'pending' check (payment_status in ('pending', 'submitted', 'confirmed')),
  payment_proof_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  phone text,
  team_id uuid references public.teams(id) on delete set null,
  role text not null check (role in ('admin', 'coach', 'team_manager', 'player')),
  jersey_number integer,
  emergency_contact text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;

-- Tournaments: anyone can read, only admins can modify
create policy "Tournaments are viewable by everyone"
  on public.tournaments for select using (true);

create policy "Admins can manage tournaments"
  on public.tournaments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Teams: anyone can read, coaches/admins can manage
create policy "Teams are viewable by everyone"
  on public.teams for select using (true);

create policy "Coaches can create teams"
  on public.teams for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'coach', 'team_manager'))
  );

create policy "Team coaches can update their team"
  on public.teams for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and team_id = teams.id
      and role in ('coach', 'team_manager')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Profiles: users can read all, manage their own
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'player')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- PHASE 2: Resource Planning
-- =============================================

-- Pitches: physical locations available for matches
create table public.pitches (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  location text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Time slots: available time windows on pitches
create table public.time_slots (
  id uuid default uuid_generate_v4() primary key,
  pitch_id uuid references public.pitches(id) on delete cascade not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Referees
create table public.referees (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  full_name text not null,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Runners: people who report match results
create table public.runners (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  full_name text not null,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Phase 2 tables
alter table public.pitches enable row level security;
alter table public.time_slots enable row level security;
alter table public.referees enable row level security;
alter table public.runners enable row level security;

create policy "Pitches are viewable by everyone"
  on public.pitches for select using (true);

create policy "Admins can manage pitches"
  on public.pitches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Time slots are viewable by everyone"
  on public.time_slots for select using (true);

create policy "Admins can manage time slots"
  on public.time_slots for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Referees are viewable by everyone"
  on public.referees for select using (true);

create policy "Admins can manage referees"
  on public.referees for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Runners are viewable by everyone"
  on public.runners for select using (true);

create policy "Admins can manage runners"
  on public.runners for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================
-- PHASE 3: Match Scheduling
-- =============================================

-- Groups: for group-stage play (e.g. Group A, Group B)
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group memberships: which teams are in which group
create table public.group_teams (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  unique(group_id, team_id)
);

-- Matches
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  stage text not null check (stage in ('group', 'semi_final', 'final', 'third_place', 'quarter_final', 'round_of_16')),
  group_id uuid references public.groups(id) on delete set null,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  home_score integer,
  away_score integer,
  time_slot_id uuid references public.time_slots(id) on delete set null,
  referee_id uuid references public.referees(id) on delete set null,
  runner_id uuid references public.runners(id) on delete set null,
  status text default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  match_order integer,
  placeholder_home text,
  placeholder_away text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Phase 3 tables
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.matches enable row level security;

create policy "Groups are viewable by everyone"
  on public.groups for select using (true);

create policy "Admins can manage groups"
  on public.groups for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Group teams are viewable by everyone"
  on public.group_teams for select using (true);

create policy "Admins can manage group teams"
  on public.group_teams for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Matches are viewable by everyone"
  on public.matches for select using (true);

create policy "Admins can manage matches"
  on public.matches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Storage bucket for payment proofs
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false);

create policy "Team members can upload payment proofs"
  on storage.objects for insert with check (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can view payment proofs"
  on storage.objects for select using (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
  );
