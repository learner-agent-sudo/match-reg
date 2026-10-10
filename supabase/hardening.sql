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
