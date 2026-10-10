-- RESET SCRIPT: Drops all existing tables and re-creates everything
-- Safe to run multiple times

-- Drop tables in reverse dependency order
drop table if exists public.matches cascade;
drop table if exists public.group_teams cascade;
drop table if exists public.groups cascade;
drop table if exists public.runners cascade;
drop table if exists public.referees cascade;
drop table if exists public.time_slots cascade;
drop table if exists public.pitches cascade;
drop table if exists public.profiles cascade;
drop table if exists public.teams cascade;
drop table if exists public.tournaments cascade;

-- Drop the trigger and function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.protect_profile_role() cascade;
drop function if exists public.is_admin() cascade;

-- Delete storage buckets (ignore error if they don't exist)
-- NOTE: Storage buckets must be managed via the Supabase Dashboard > Storage
-- Go to Storage, delete 'payment-proofs' and 'team-logos' buckets if they exist

-- Delete any existing auth users (clean slate)
-- Comment this out if you want to keep existing user accounts
-- delete from auth.users;

-- =============================================
-- Now re-create everything from scratch
-- =============================================

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
  logo_url text,
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

-- Pitches
create table public.pitches (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  location text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Time slots
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

-- Runners
create table public.runners (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  full_name text not null,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groups
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group memberships
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

-- =============================================
-- Row Level Security
-- =============================================

alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.pitches enable row level security;
alter table public.time_slots enable row level security;
alter table public.referees enable row level security;
alter table public.runners enable row level security;
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.matches enable row level security;

-- Tournaments
create policy "Tournaments are viewable by everyone"
  on public.tournaments for select using (true);
create policy "Admins can manage tournaments"
  on public.tournaments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Teams
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

-- Profiles
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

-- Pitches
create policy "Pitches are viewable by everyone"
  on public.pitches for select using (true);
create policy "Admins can manage pitches"
  on public.pitches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Time slots
create policy "Time slots are viewable by everyone"
  on public.time_slots for select using (true);
create policy "Admins can manage time slots"
  on public.time_slots for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Referees
create policy "Referees are viewable by everyone"
  on public.referees for select using (true);
create policy "Admins can manage referees"
  on public.referees for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Runners
create policy "Runners are viewable by everyone"
  on public.runners for select using (true);
create policy "Admins can manage runners"
  on public.runners for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Groups
create policy "Groups are viewable by everyone"
  on public.groups for select using (true);
create policy "Admins can manage groups"
  on public.groups for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Group teams
create policy "Group teams are viewable by everyone"
  on public.group_teams for select using (true);
create policy "Admins can manage group teams"
  on public.group_teams for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Matches
create policy "Matches are viewable by everyone"
  on public.matches for select using (true);
create policy "Admins can manage matches"
  on public.matches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================
-- Trigger for auto-creating profiles on signup
-- =============================================

-- Roles are decided by the database, never by the browser.
-- Helper: is the logged-in user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- New signups: the very first account becomes admin. Everyone else gets the
-- role they picked, but only coach / team_manager / player are allowed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := new.raw_user_meta_data->>'role';
  assigned text;
begin
  if not exists (select 1 from public.profiles) then
    assigned := 'admin';
  elsif requested in ('coach', 'team_manager', 'player') then
    assigned := requested;
  else
    assigned := 'player';
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email, assigned);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Users may edit their own profile, but only an admin may change a role.
-- (Changes made in the Supabase dashboard / SQL editor are still allowed.)
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

-- These helpers are only for the database itself, not the public web API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- =============================================
-- Storage (uses INSERT ... ON CONFLICT to avoid errors on re-run)
-- =============================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

-- Storage policies (drop first to avoid "already exists" errors)
drop policy if exists "Team members can upload payment proofs" on storage.objects;
drop policy if exists "Authenticated users can view payment proofs" on storage.objects;
drop policy if exists "Coaches can upload team logos" on storage.objects;
drop policy if exists "Anyone can view team logos" on storage.objects;

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

create policy "Coaches can upload team logos"
  on storage.objects for insert with check (
    bucket_id = 'team-logos'
    and auth.role() = 'authenticated'
  );

create policy "Anyone can view team logos"
  on storage.objects for select using (
    bucket_id = 'team-logos'
  );

-- =============================================
-- Test Tools (admin "Test Tools" tab) — from test-tools.sql
-- =============================================

alter table public.tournaments add column if not exists is_demo boolean not null default false;

-- ---------------------------------------------------------------------------
-- Delete all demo data
-- ---------------------------------------------------------------------------
create or replace function public.demo_delete()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  users_deleted int;
  tournaments_deleted int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can use the test tools';
  end if;

  -- Login accounts (their profiles are removed with them)
  delete from auth.users
  where email like 'demo-%@example.com'
    and coalesce(raw_app_meta_data->>'demo', '') = 'true';
  get diagnostics users_deleted = row_count;

  -- Tournament: teams, pitches, time slots, referees, runners, groups and
  -- matches are all removed with it
  delete from public.tournaments where is_demo;
  get diagnostics tournaments_deleted = row_count;

  return format('Deleted %s demo tournament(s) and %s demo login(s).', tournaments_deleted, users_deleted);
end;
$$;

-- ---------------------------------------------------------------------------
-- Load a fresh demo tournament
-- ---------------------------------------------------------------------------
create or replace function public.demo_load(p_teams int default 4, p_players_per_team int default 5)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  team_names text[] := array['Thunder FC','Lightning FC','Storm FC','Blaze FC',
                             'Cyclone FC','Avalanche FC','Comet FC','Falcon FC'];
  first_names text[] := array['Alex','Ben','Chris','Dan','Eli','Finn','Gus','Hugo',
                              'Ivan','Jack','Kai','Leo','Max','Noah','Owen','Paul'];
  pw_hash text := crypt('demo1234', gen_salt('bf'));
  t_id uuid;
  g_id uuid;
  p_ids uuid[] := '{}';
  ref_ids uuid[];
  run_ids uuid[];
  team_ids uuid[] := '{}';
  v_id uuid;
  u_id uuid;
  saturday date;
  d date;
  slot_start time;
  i int; j int; k int;
  match_no int := 0;
  logins int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can use the test tools';
  end if;
  if p_teams not between 2 and 8 then
    raise exception 'Number of teams must be between 2 and 8';
  end if;
  if p_players_per_team not between 0 and 15 then
    raise exception 'Players per team must be between 0 and 15';
  end if;

  perform public.demo_delete();

  saturday := current_date + ((6 - extract(dow from current_date)::int + 7) % 7);
  if saturday = current_date then saturday := saturday + 7; end if;

  insert into public.tournaments (name, description, start_date, end_date, max_teams, registration_open, is_demo)
  values ('DEMO Cup (test data)', 'Created by Test Tools. Delete it from the Test Tools tab.',
          saturday, saturday + 1, 8, false, true)
  returning id into t_id;

  -- Pitches and time slots: 2 pitches, 45-minute games every hour 09:00-18:00, Sat + Sun
  for i in 1..2 loop
    insert into public.pitches (tournament_id, name, location, notes)
    values (t_id, 'Demo Pitch ' || chr(64 + i), 'Demo Park - Field ' || i, 'Test data')
    returning id into v_id;
    p_ids := p_ids || v_id;
  end loop;

  for k in 0..1 loop
    d := saturday + k;
    for i in 0..9 loop
      slot_start := time '09:00' + make_interval(hours => i);
      foreach v_id in array p_ids loop
        insert into public.time_slots (pitch_id, date, start_time, end_time, is_available)
        values (v_id, d, slot_start, slot_start + interval '45 minutes', true);
      end loop;
    end loop;
  end loop;

  -- Referees and runners
  with r as (
    insert into public.referees (tournament_id, full_name, phone, email)
    select t_id, 'Demo Referee ' || n, '0400-000-00' || n, null from generate_series(1, 3) n
    returning id
  ) select array_agg(id) into ref_ids from r;

  with r as (
    insert into public.runners (tournament_id, full_name, phone, email)
    select t_id, 'Demo Runner ' || n, '0411-000-00' || n, null from generate_series(1, 2) n
    returning id
  ) select array_agg(id) into run_ids from r;

  -- Teams with coach, team manager and players (all can log in)
  for i in 1..p_teams loop
    insert into public.teams (tournament_id, name, payment_status)
    values (t_id, team_names[i],
            (array['confirmed','submitted','pending'])[1 + (i - 1) % 3])
    returning id into v_id;
    team_ids := team_ids || v_id;

    for j in 0..(p_players_per_team + 1) loop
      u_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', u_id, 'authenticated', 'authenticated',
        case j when 0 then format('demo-coach%s@example.com', i)
               when 1 then format('demo-manager%s@example.com', i)
               else format('demo-player%s-%s@example.com', i, j - 1) end,
        pw_hash, now(),
        '{"provider":"email","providers":["email"],"demo":"true"}'::jsonb,
        jsonb_build_object(
          'full_name', case j when 0 then 'Coach ' || split_part(team_names[i], ' ', 1)
                              when 1 then 'Manager ' || split_part(team_names[i], ' ', 1)
                              else first_names[1 + ((i * 7 + j) % 16)] || ' ' || split_part(team_names[i], ' ', 1) end,
          'role', case j when 0 then 'coach' when 1 then 'team_manager' else 'player' end),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      select u_id::text, u_id,
             jsonb_build_object('sub', u_id::text, 'email', u.email, 'email_verified', true),
             'email', now(), now(), now()
      from auth.users u where u.id = u_id;

      -- The signup trigger created the profile; attach it to the team
      update public.profiles
      set team_id = v_id,
          jersey_number = case when j >= 2 then j - 1 end,
          phone = '0499-' || lpad((i * 100 + j)::text, 3, '0')
      where id = u_id;

      logins := logins + 1;
    end loop;
  end loop;

  -- One group with every team, plus round-robin matches.
  -- Referees and runners are assigned; time slots are left empty so the
  -- "Auto Schedule" button can be tested.
  insert into public.groups (tournament_id, name) values (t_id, 'Group A') returning id into g_id;
  insert into public.group_teams (group_id, team_id) select g_id, unnest(team_ids);

  for i in 1..p_teams loop
    for j in (i + 1)..p_teams loop
      match_no := match_no + 1;
      insert into public.matches (tournament_id, stage, group_id, home_team_id, away_team_id,
                                  referee_id, runner_id, status, match_order)
      values (t_id, 'group', g_id, team_ids[i], team_ids[j],
              ref_ids[1 + (match_no - 1) % array_length(ref_ids, 1)],
              run_ids[1 + (match_no - 1) % array_length(run_ids, 1)],
              'scheduled', match_no);
    end loop;
  end loop;

  return format('Demo tournament created: %s teams, %s logins, %s group matches, 2 pitches, 40 time slots, 3 referees, 2 runners. Every demo password is demo1234.',
                p_teams, logins, match_no);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fill random scores
--   p_stage = 'group'   : every unplayed group match in the demo tournament
--   p_stage = 'playoff' : semi-finals, then moves winners/losers into the
--                         final / 3rd-place match and plays those too
-- ---------------------------------------------------------------------------
create or replace function public.demo_fill_scores(p_stage text default 'group')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  m record;
  h int; a int;
  filled int := 0;
  sf record;
  winners uuid[] := '{}';
  losers uuid[] := '{}';
begin
  if not public.is_admin() then
    raise exception 'Only an admin can use the test tools';
  end if;

  select id into t_id from public.tournaments where is_demo limit 1;
  if t_id is null then
    raise exception 'No demo tournament yet. Click "Load demo tournament" first.';
  end if;

  if p_stage = 'group' then
    for m in select id from public.matches
             where tournament_id = t_id and stage = 'group' and status <> 'completed' loop
      update public.matches
      set home_score = floor(random() * 5)::int, away_score = floor(random() * 5)::int, status = 'completed'
      where id = m.id;
      filled := filled + 1;
    end loop;
    return format('Filled scores for %s group match(es).', filled);
  end if;

  if p_stage <> 'playoff' then
    raise exception 'Unknown stage %', p_stage;
  end if;

  if not exists (select 1 from public.matches where tournament_id = t_id and stage = 'semi_final') then
    raise exception 'No playoff matches yet. In the Matches tab, open Group Setup and click "Generate Playoffs".';
  end if;
  if exists (select 1 from public.matches where tournament_id = t_id and stage = 'semi_final'
             and (home_team_id is null or away_team_id is null)) then
    raise exception 'The semi-finals have no teams yet. Finish the group stage, then click "Generate Playoffs" again.';
  end if;

  -- Semi-finals (no draws in a knockout game)
  for sf in select * from public.matches
            where tournament_id = t_id and stage = 'semi_final' order by match_order loop
    if sf.status = 'completed' then
      h := sf.home_score; a := sf.away_score;
    else
      h := floor(random() * 5)::int; a := floor(random() * 5)::int;
      if h = a then h := h + 1; end if;
      update public.matches set home_score = h, away_score = a, status = 'completed' where id = sf.id;
      filled := filled + 1;
    end if;
    if h > a then
      winners := winners || sf.home_team_id; losers := losers || sf.away_team_id;
    else
      winners := winners || sf.away_team_id; losers := losers || sf.home_team_id;
    end if;
  end loop;

  if array_length(winners, 1) = 2 then
    update public.matches set home_team_id = winners[1], away_team_id = winners[2]
    where tournament_id = t_id and stage = 'final';
    update public.matches set home_team_id = losers[1], away_team_id = losers[2]
    where tournament_id = t_id and stage = 'third_place';
  end if;

  for m in select id from public.matches
           where tournament_id = t_id and stage in ('third_place', 'final') and status <> 'completed'
             and home_team_id is not null and away_team_id is not null loop
    h := floor(random() * 5)::int; a := floor(random() * 5)::int;
    if h = a then a := a + 1; end if;
    update public.matches set home_score = h, away_score = a, status = 'completed' where id = m.id;
    filled := filled + 1;
  end loop;

  return format('Filled scores for %s playoff match(es).', filled);
end;
$$;

-- ---------------------------------------------------------------------------
-- Clear every score in the demo tournament (matches go back to unplayed)
-- ---------------------------------------------------------------------------
create or replace function public.demo_clear_scores()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t_id uuid;
  cleared int;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can use the test tools';
  end if;

  select id into t_id from public.tournaments where is_demo limit 1;
  if t_id is null then
    raise exception 'No demo tournament yet.';
  end if;

  update public.matches
  set home_score = null, away_score = null, status = 'scheduled'
  where tournament_id = t_id;
  get diagnostics cleared = row_count;

  -- Final / 3rd place go back to "SF1 Winner vs SF2 Winner" style placeholders
  update public.matches set home_team_id = null where tournament_id = t_id and placeholder_home is not null;
  update public.matches set away_team_id = null where tournament_id = t_id and placeholder_away is not null;

  return format('Cleared scores on %s match(es).', cleared);
end;
$$;

-- Only signed-in users may call these (each one also checks for admin)
revoke execute on function public.demo_delete() from public, anon;
revoke execute on function public.demo_load(int, int) from public, anon;
revoke execute on function public.demo_fill_scores(text) from public, anon;
revoke execute on function public.demo_clear_scores() from public, anon;
grant execute on function public.demo_delete() to authenticated;
grant execute on function public.demo_load(int, int) to authenticated;
grant execute on function public.demo_fill_scores(text) to authenticated;
grant execute on function public.demo_clear_scores() to authenticated;

-- =============================================
-- Hardening — from hardening.sql
-- =============================================

-- HARDENING: the site has no server, so every rule must live in the database.
-- Safe to run more than once. Run AFTER reset.sql / schema.sql (it is also
-- appended to the end of both).
--
-- What this closes:
--   * invite codes, payment proofs and referee/runner phone numbers were readable by anyone
--   * every logged-in user could read every profile (email, phone, emergency contact)
--   * a coach could move into another team, confirm their own payment,
--     create pre-paid teams, or join a closed / full tournament
--   * any logged-in user could upload into any team's storage folder
--   * no size or file-type limits on uploads

-- ---------------------------------------------------------------------------
-- Helpers used inside the rules below (safe to expose: they only describe
-- the person who is asking)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.my_team_id()
returns uuid language sql security definer set search_path = public stable
as $$ select team_id from public.profiles where id = auth.uid(); $$;

create or replace function public.my_role()
returns text language sql security definer set search_path = public stable
as $$ select role from public.profiles where id = auth.uid(); $$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_team_id() to anon, authenticated;
grant execute on function public.my_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The only ways a non-admin can create a team or join one
-- ---------------------------------------------------------------------------
create or replace function public.register_team(p_tournament uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  t public.tournaments;
  clean text := btrim(p_name);
  new_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please sign in first'; end if;
  if me.role not in ('coach', 'team_manager') then
    raise exception 'Only a coach or team manager can register a team';
  end if;
  if me.team_id is not null then raise exception 'You already have a team'; end if;
  if clean is null or length(clean) < 2 or length(clean) > 60 then
    raise exception 'Team name must be 2 to 60 characters';
  end if;

  select * into t from public.tournaments where id = p_tournament for update;
  if t.id is null or not t.registration_open then
    raise exception 'This tournament is not open for registration';
  end if;
  if (select count(*) from public.teams where tournament_id = t.id) >= coalesce(t.max_teams, 8) then
    raise exception 'Sorry, this tournament is full';
  end if;
  if exists (select 1 from public.teams where tournament_id = t.id and lower(name) = lower(clean)) then
    raise exception 'A team with that name is already registered';
  end if;

  insert into public.teams (tournament_id, name) values (t.id, clean) returning id into new_id;
  update public.profiles set team_id = new_id where id = me.id;
  return new_id;
end;
$$;

create or replace function public.team_name_for_invite(p_code text)
returns text language sql security definer set search_path = public stable
as $$ select name from public.teams where invite_code = p_code; $$;

create or replace function public.join_team(p_code text, p_jersey int default null, p_emergency text default null)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  t_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Please sign in first'; end if;
  select id into t_id from public.teams where invite_code = p_code;
  if t_id is null then raise exception 'This invite link is not valid'; end if;
  if me.team_id is not null and me.team_id <> t_id then raise exception 'You are already in another team'; end if;
  if me.role <> 'player' then raise exception 'Only players join with an invite link'; end if;
  if p_jersey is not null and p_jersey not between 0 and 99 then raise exception 'Jersey number must be 0 to 99'; end if;

  update public.profiles
  set team_id = t_id,
      jersey_number = p_jersey,
      emergency_contact = left(nullif(btrim(p_emergency), ''), 200)
  where id = me.id;
  return t_id;
end;
$$;

create or replace function public.my_invite_code()
returns text language sql security definer set search_path = public stable
as $$
  select t.invite_code from public.teams t
  join public.profiles p on p.team_id = t.id
  where p.id = auth.uid() and p.role in ('coach', 'team_manager');
$$;

revoke execute on function public.register_team(uuid, text) from public, anon;
revoke execute on function public.join_team(text, int, text) from public, anon;
revoke execute on function public.my_invite_code() from public, anon;
grant execute on function public.register_team(uuid, text) to authenticated;
grant execute on function public.join_team(text, int, text) to authenticated;
grant execute on function public.my_invite_code() to authenticated;
grant execute on function public.team_name_for_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Field guards. They apply to people using the website (roles anon /
-- authenticated); the functions above and the Supabase dashboard are trusted.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change roles';
    end if;
    if new.team_id is distinct from old.team_id then
      raise exception 'Use your team''s invite link to join a team';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email cannot be changed here';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.protect_team_fields()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if new.tournament_id is distinct from old.tournament_id
       or new.invite_code is distinct from old.invite_code then
      raise exception 'Only an admin can change this';
    end if;
    if new.payment_status is distinct from old.payment_status
       and not (new.payment_status = 'submitted' and old.payment_status in ('pending', 'submitted')) then
      raise exception 'Only an admin can confirm payments';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger protect_team_fields
  before update on public.teams
  for each row execute function public.protect_team_fields();

revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.protect_team_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row rules
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Profiles visible to self, teammates and admins" on public.profiles;
create policy "Profiles visible to self, teammates and admins" on public.profiles
  for select using (
    id = auth.uid() or public.is_admin()
    or (team_id is not null and team_id = public.my_team_id())
  );

drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Profiles are created by the signup trigger only" on public.profiles;
create policy "Profiles are created by the signup trigger only" on public.profiles
  for insert with check (false);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Coaches can create teams" on public.teams;
drop policy if exists "Admins can insert teams" on public.teams;
create policy "Admins can insert teams" on public.teams
  for insert with check (public.is_admin());

drop policy if exists "Team coaches can update their team" on public.teams;
create policy "Team coaches can update their team" on public.teams
  for update
  using (public.is_admin() or (id = public.my_team_id() and public.my_role() in ('coach', 'team_manager')))
  with check (public.is_admin() or (id = public.my_team_id() and public.my_role() in ('coach', 'team_manager')));

drop policy if exists "Referees are viewable by everyone" on public.referees;
drop policy if exists "Referees are viewable by admins" on public.referees;
create policy "Referees are viewable by admins" on public.referees for select using (public.is_admin());

drop policy if exists "Runners are viewable by everyone" on public.runners;
drop policy if exists "Runners are viewable by admins" on public.runners;
create policy "Runners are viewable by admins" on public.runners for select using (public.is_admin());

-- Team rows stay public (names and logos appear on results pages), but the
-- invite code and payment proof are hidden from the web API.
revoke select on public.teams from anon, authenticated;
grant select (id, tournament_id, name, logo_url, created_at) on public.teams to anon;
grant select (id, tournament_id, name, logo_url, created_at, payment_status) on public.teams to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: each team can only touch its own folder; admins can read all.
-- ---------------------------------------------------------------------------
update storage.buckets
set public = false, file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']
where id = 'payment-proofs';

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'team-logos';

drop policy if exists "Team members can upload payment proofs" on storage.objects;
create policy "Team members can upload payment proofs" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = public.my_team_id()::text
    and public.my_role() in ('coach', 'team_manager')
  );

drop policy if exists "Team staff can replace their payment proof" on storage.objects;
create policy "Team staff can replace their payment proof" on storage.objects
  for update
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = public.my_team_id()::text
         and public.my_role() in ('coach', 'team_manager'))
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = public.my_team_id()::text
              and public.my_role() in ('coach', 'team_manager'));

drop policy if exists "Authenticated users can view payment proofs" on storage.objects;
drop policy if exists "Own team and admins can view payment proofs" on storage.objects;
create policy "Own team and admins can view payment proofs" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (public.is_admin() or (storage.foldername(name))[1] = public.my_team_id()::text)
  );

drop policy if exists "Coaches can upload team logos" on storage.objects;
create policy "Coaches can upload team logos" on storage.objects
  for insert with check (
    bucket_id = 'team-logos'
    and (public.is_admin()
         or ((storage.foldername(name))[1] = public.my_team_id()::text
             and public.my_role() in ('coach', 'team_manager')))
  );

drop policy if exists "Team staff can replace their logo" on storage.objects;
create policy "Team staff can replace their logo" on storage.objects
  for update
  using (bucket_id = 'team-logos' and (public.is_admin()
         or ((storage.foldername(name))[1] = public.my_team_id()::text and public.my_role() in ('coach', 'team_manager'))))
  with check (bucket_id = 'team-logos' and (public.is_admin()
         or ((storage.foldername(name))[1] = public.my_team_id()::text and public.my_role() in ('coach', 'team_manager'))));
