-- TEST TOOLS: one-click demo data for the admin "Test Tools" tab.
-- Safe to run more than once. Also included at the end of reset.sql.
--
-- Everything these functions create belongs to ONE demo tournament
-- (tournaments.is_demo = true) plus demo login accounts whose email starts
-- with "demo-" and ends with "@example.com". "Delete demo data" removes
-- exactly that, and nothing else. Only admins can run these functions.

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
