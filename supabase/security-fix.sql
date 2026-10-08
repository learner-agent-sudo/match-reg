-- SECURITY FIX: roles are decided by the database, never by the browser.
-- Safe to run more than once. Already included in reset.sql and schema.sql;
-- run this on its own only if your database was set up before this fix.

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
revoke execute on function public.is_admin() from public, anon, authenticated;
