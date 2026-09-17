-- Private pilot access is granted by an administrator, never by user-editable metadata.
create table public.beta_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.beta_access enable row level security;
revoke all on public.beta_access from anon, authenticated;

create or replace function public.is_beta_user()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.beta_access where user_id = auth.uid() and enabled); $$;
revoke all on function public.is_beta_user() from public;
grant execute on function public.is_beta_user() to authenticated;

drop policy "users manage their own profile" on public.profiles;
drop policy "users manage their own routes" on public.running_routes;
drop policy "users manage their own runs" on public.runs;
create policy "approved owner profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id and (select public.is_beta_user()))
  with check ((select auth.uid()) = id and (select public.is_beta_user()));
create policy "approved owner routes" on public.running_routes for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_beta_user()))
  with check ((select auth.uid()) = owner_id and (select public.is_beta_user()));
create policy "approved owner runs" on public.runs for all to authenticated
  using ((select auth.uid()) = owner_id and (select public.is_beta_user()))
  with check ((select auth.uid()) = owner_id and (select public.is_beta_user()));

-- Dormant game data contains identifying foreign keys. Keep it inaccessible until phase four.
drop policy "territory cells are readable" on public.territory_cells;
drop policy "claim history is readable" on public.territory_claims;
revoke all on public.territory_cells, public.territory_claims, public.squads, public.squad_members from anon, authenticated;
revoke all on public.profiles, public.running_routes, public.runs from anon;
grant select, insert, update, delete on public.profiles, public.running_routes, public.runs to authenticated;

alter table public.runs add column client_record jsonb;
alter table public.runs add constraint client_record_shape check (
  client_record is null or (jsonb_typeof(client_record) = 'object' and pg_column_size(client_record) <= 2000000)
);

-- RLS on runs alone does not stop a caller attaching their run to somebody else's route ID.
create or replace function public.check_run_route_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.route_id is not null and not exists (
    select 1 from public.running_routes where id = new.route_id and owner_id = new.owner_id
  ) then raise exception 'Route is not available to this owner' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function public.check_run_route_owner() from public;
create trigger runs_check_route_owner before insert or update on public.runs
for each row execute function public.check_run_route_owner();

-- Inviting a user does not itself grant beta access. Admin adds beta_access and profile together.
create or replace function public.provision_beta_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values(new.user_id, 'Běžec') on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.provision_beta_profile() from public;
create trigger provision_beta_profile after insert on public.beta_access
for each row execute function public.provision_beta_profile();

-- Keep only an ID marker after deletion, so an older phone cannot resurrect the GPS record.
create table public.run_deletions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  deleted_at timestamptz not null default now(),
  primary key(owner_id, run_id)
);
alter table public.run_deletions enable row level security;
revoke all on public.run_deletions from anon, authenticated;
grant select on public.run_deletions to authenticated;
create policy "owner deletion markers" on public.run_deletions for select to authenticated
using (owner_id = (select auth.uid()) and (select public.is_beta_user()));

create function public.delete_private_run(target_run_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_beta_user() then raise exception 'Access denied' using errcode = '42501'; end if;
  -- Lock this owner/ID pair across inserts and deletes to prevent sync/delete races.
  perform pg_advisory_xact_lock(hashtextextended(actor::text || target_run_id::text, 0));
  insert into public.run_deletions(owner_id, run_id) values(actor, target_run_id) on conflict do nothing;
  delete from public.runs where id = target_run_id and owner_id = actor;
end;
$$;
revoke all on function public.delete_private_run(uuid) from public;
grant execute on function public.delete_private_run(uuid) to authenticated;

create function public.reject_deleted_run()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text || new.id::text, 0));
  if exists(select 1 from public.run_deletions where owner_id = new.owner_id and run_id = new.id)
    then raise exception 'Run has been deleted' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function public.reject_deleted_run() from public;
create trigger reject_deleted_run before insert or update on public.runs for each row execute function public.reject_deleted_run();
