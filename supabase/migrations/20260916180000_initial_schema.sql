-- RunGuide: personal running data plus a dormant foundation for Territory & Clans.
-- Apply with the Supabase CLI after a project is created. No public policy exposes raw routes.

create extension if not exists pgcrypto;

create type public.run_status as enum ('planned', 'in_progress', 'completed', 'abandoned');
create type public.territory_visibility as enum ('private', 'friends', 'public');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  territory_visibility public.territory_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.running_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  -- Compact, simplified LineString-like array: [[longitude, latitude], ...].
  simplified_path jsonb not null check (jsonb_typeof(simplified_path) = 'array'),
  distance_meters integer not null check (distance_meters > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid references public.running_routes(id) on delete set null,
  status public.run_status not null default 'planned',
  started_at timestamptz,
  finished_at timestamptz,
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  average_pace_seconds_per_km integer check (average_pace_seconds_per_km is null or average_pace_seconds_per_km > 0),
  -- Simplified final trace; private even after Territory & Clans launches.
  simplified_path jsonb check (simplified_path is null or jsonb_typeof(simplified_path) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

-- Future game data. A cell key will be generated client-side/server-side with h3-js;
-- no PostGIS or H3 database extension is required for the initial personal version.
create table public.territory_cells (
  cell_id text primary key,
  resolution smallint not null check (resolution between 0 and 15),
  owner_id uuid references public.profiles(id) on delete set null,
  claimed_by_run_id uuid references public.runs(id) on delete set null,
  captured_at timestamptz not null default now()
);

create table public.territory_claims (
  id uuid primary key default gen_random_uuid(),
  cell_id text not null references public.territory_cells(cell_id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  previous_owner_id uuid references public.profiles(id) on delete set null,
  new_owner_id uuid not null references public.profiles(id) on delete cascade,
  captured_at timestamptz not null default now()
);

create table public.squads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table public.squad_members (
  squad_id uuid not null references public.squads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, profile_id)
);

create index running_routes_owner_id_idx on public.running_routes(owner_id);
create index runs_owner_id_started_at_idx on public.runs(owner_id, started_at desc);
create index territory_cells_owner_id_idx on public.territory_cells(owner_id);
create index territory_claims_cell_id_idx on public.territory_claims(cell_id, captured_at desc);

alter table public.profiles enable row level security;
alter table public.running_routes enable row level security;
alter table public.runs enable row level security;
alter table public.territory_cells enable row level security;
alter table public.territory_claims enable row level security;
alter table public.squads enable row level security;
alter table public.squad_members enable row level security;

create policy "users manage their own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "users manage their own routes" on public.running_routes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "users manage their own runs" on public.runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- These policies deliberately permit only reads. A future server-side function will
-- validate a completed run and atomically claim cells; the browser never writes game state.
create policy "territory cells are readable" on public.territory_cells
  for select using (true);
create policy "claim history is readable" on public.territory_claims
  for select using (true);

-- Squad policies are intentionally absent until invitation and membership rules are designed.
