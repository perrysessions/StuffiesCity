-- Run this in your Supabase project's SQL Editor (Dashboard → SQL Editor → New Query)
-- This is a CLEAN SLATE schema — drop existing tables first if re-running.
-- IMPORTANT: Run the entire script at once.

-- ── 0. Drop old tables (safe to re-run during dev) ───────────────────────────
drop table if exists game_sessions cascade;
drop table if exists friendships   cascade;
drop table if exists user_stuffies cascade;
drop table if exists profiles      cascade;

-- ── 1. Create tables ─────────────────────────────────────────────────────────

-- One parent auth account can have multiple child profiles (one per girl)
create table profiles (
  id             uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  username       text unique not null,
  grade          int  not null check (grade between 1 and 5),
  coins          int  not null default 0,
  avatar_emoji   text not null default '🐱',
  created_at     timestamptz default now()
);

create table user_stuffies (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  stuffie_key text not null,
  rarity      text not null check (rarity in ('common','uncommon','rare','epic','legendary','mythic')),
  acquired_at timestamptz default now()
);

-- For external (non-family) friendships only; siblings are auto-friends via RLS
create table friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz default now(),
  unique (requester_id, addressee_id)
);

create table game_sessions (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references profiles(id) on delete cascade,
  game_type          text not null check (game_type in ('english','math','reading')),
  questions_answered int  not null default 0,
  correct            int  not null default 0,
  coins_earned       int  not null default 0,
  created_at         timestamptz default now()
);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table user_stuffies enable row level security;
alter table friendships   enable row level security;
alter table game_sessions enable row level security;

-- ── 2b. Helper function (security definer = bypasses RLS, no recursion) ───────
-- Returns the profile IDs belonging to the currently logged-in parent account.
create or replace function my_profile_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select id from profiles where parent_user_id = auth.uid()
$$;

-- ── 3. Policies: profiles ─────────────────────────────────────────────────────

-- Full access to all profiles in your family (same parent_user_id)
create policy "profiles: family full access"
  on profiles for all
  using  (auth.uid() = parent_user_id)
  with check (auth.uid() = parent_user_id);

-- External friends can read profiles (uses helper to avoid self-referencing recursion)
create policy "profiles: external friends can view"
  on profiles for select
  using (
    exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = any(select my_profile_ids()) and f.addressee_id = profiles.id)
          or
          (f.addressee_id = any(select my_profile_ids()) and f.requester_id = profiles.id)
        )
    )
  );

-- ── 4. Policies: user_stuffies ────────────────────────────────────────────────

-- Full access to stuffies belonging to any profile in your family
create policy "stuffies: family full access"
  on user_stuffies for all
  using  (profile_id = any(select my_profile_ids()))
  with check (profile_id = any(select my_profile_ids()));

-- External friends can view stuffies
create policy "stuffies: external friends can view"
  on user_stuffies for select
  using (
    exists (
      select 1 from friendships f
      join profiles p on p.id = user_stuffies.profile_id
      where f.status = 'accepted'
        and (
          (f.requester_id = any(select my_profile_ids()) and f.addressee_id = p.id)
          or
          (f.addressee_id = any(select my_profile_ids()) and f.requester_id = p.id)
        )
    )
  );

-- ── 5. Policies: friendships ──────────────────────────────────────────────────

create policy "friendships: view own"
  on friendships for select
  using (
    requester_id = any(select my_profile_ids())
    or addressee_id = any(select my_profile_ids())
  );

create policy "friendships: send request"
  on friendships for insert
  with check (requester_id = any(select my_profile_ids()));

create policy "friendships: accept request"
  on friendships for update
  using (addressee_id = any(select my_profile_ids()));

-- ── 6. Policies: game_sessions ────────────────────────────────────────────────

create policy "sessions: family full access"
  on game_sessions for all
  using  (profile_id = any(select my_profile_ids()))
  with check (profile_id = any(select my_profile_ids()));
