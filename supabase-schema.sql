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
  room_color     text not null default 'pink',
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
  game_type          text not null check (game_type in ('english','math','reading','geography','mathblast')),
  questions_answered int  not null default 0,
  correct            int  not null default 0,
  coins_earned       int  not null default 0,
  created_at         timestamptz default now()
);

create table mathblast_scores (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  username    text not null,
  grade       int  not null,
  score       int  not null,
  correct     int  not null default 0,
  answered    int  not null default 0,
  created_at  timestamptz default now()
);

create table trade_requests (
  id                   uuid primary key default gen_random_uuid(),
  proposer_id          uuid not null references profiles(id) on delete cascade,
  receiver_id          uuid not null references profiles(id) on delete cascade,
  proposer_stuffie_ids uuid[] not null,
  receiver_stuffie_ids uuid[] not null,
  status               text not null default 'pending'
                         check (status in ('pending','accepted','declined','cancelled')),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table user_stuffies enable row level security;
alter table friendships   enable row level security;
alter table game_sessions      enable row level security;
alter table mathblast_scores   enable row level security;
alter table trade_requests     enable row level security;

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

-- ── 7. Policies: mathblast_scores ─────────────────────────────────────────────

-- All logged-in users can read scores (leaderboard)
create policy "mathblast_scores: authenticated read"
  on mathblast_scores for select
  using (auth.uid() is not null);

-- Only own family profiles can insert
create policy "mathblast_scores: family insert"
  on mathblast_scores for insert
  with check (profile_id = any(select my_profile_ids()));

-- ── 8. Policies: trade_requests ──────────────────────────────────────────────

-- Proposer and receiver can read their own trades
create policy "trades: parties can view"
  on trade_requests for select
  using (
    proposer_id = any(select my_profile_ids())
    or receiver_id = any(select my_profile_ids())
  );

-- Only proposer can create a trade
create policy "trades: proposer can insert"
  on trade_requests for insert
  with check (proposer_id = any(select my_profile_ids()));

-- Both parties can update status (accept/decline/cancel) — RPC enforces auth
create policy "trades: parties can update"
  on trade_requests for update
  using (
    proposer_id = any(select my_profile_ids())
    or receiver_id = any(select my_profile_ids())
  );

-- ── 9. accept_trade RPC (atomic stuffie swap) ─────────────────────────────────

create or replace function accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  t trade_requests;
begin
  select * into t from trade_requests where id = p_trade_id and status = 'pending';
  if not found then
    raise exception 'Trade not found or already resolved';
  end if;

  -- Only the receiver can accept
  if not exists (
    select 1 from profiles where id = t.receiver_id and parent_user_id = auth.uid()
  ) then
    raise exception 'Not authorized to accept this trade';
  end if;

  -- Validate stuffies still belong to the right owners
  if (select count(*) from user_stuffies
      where id = any(t.proposer_stuffie_ids) and profile_id = t.proposer_id)
     != cardinality(t.proposer_stuffie_ids) then
    raise exception 'Some offered stuffies are no longer available';
  end if;

  if (select count(*) from user_stuffies
      where id = any(t.receiver_stuffie_ids) and profile_id = t.receiver_id)
     != cardinality(t.receiver_stuffie_ids) then
    raise exception 'Some requested stuffies are no longer available';
  end if;

  -- Atomic swap
  update user_stuffies set profile_id = t.receiver_id
    where id = any(t.proposer_stuffie_ids);
  update user_stuffies set profile_id = t.proposer_id
    where id = any(t.receiver_stuffie_ids);

  -- Remove room placements for stuffies traded away (if no copies remain)
  delete from room_placements rp
  using (select stuffie_key from user_stuffies where id = any(t.proposer_stuffie_ids)) traded
  where rp.stuffie_key = traded.stuffie_key
    and rp.profile_id  = t.proposer_id
    and not exists (
      select 1 from user_stuffies
      where profile_id = t.proposer_id and stuffie_key = traded.stuffie_key
    );

  delete from room_placements rp
  using (select stuffie_key from user_stuffies where id = any(t.receiver_stuffie_ids)) traded
  where rp.stuffie_key = traded.stuffie_key
    and rp.profile_id  = t.receiver_id
    and not exists (
      select 1 from user_stuffies
      where profile_id = t.receiver_id and stuffie_key = traded.stuffie_key
    );

  -- Mark accepted
  update trade_requests
    set status = 'accepted', updated_at = now()
    where id = p_trade_id;

  -- Cancel any other pending trades that involved the same stuffies
  update trade_requests
    set status = 'cancelled', updated_at = now()
    where id != p_trade_id
      and status = 'pending'
      and (
        proposer_stuffie_ids && t.proposer_stuffie_ids or
        proposer_stuffie_ids && t.receiver_stuffie_ids or
        receiver_stuffie_ids && t.proposer_stuffie_ids or
        receiver_stuffie_ids && t.receiver_stuffie_ids
      );
end;
$$;

-- ── MIGRATION (existing installs only — skip on fresh setup) ─────────────────
-- Run this block separately if you already have the tables set up:
--
-- alter table game_sessions drop constraint if exists game_sessions_game_type_check;
-- alter table game_sessions add constraint game_sessions_game_type_check
--   check (game_type in ('english','math','reading','geography','mathblast'));
--
-- create table if not exists mathblast_scores (
--   id uuid primary key default gen_random_uuid(),
--   profile_id uuid not null references profiles(id) on delete cascade,
--   username text not null, grade int not null, score int not null,
--   correct int not null default 0, answered int not null default 0,
--   created_at timestamptz default now()
-- );
-- alter table mathblast_scores enable row level security;
-- create policy "mathblast_scores: authenticated read" on mathblast_scores for select using (auth.uid() is not null);
-- create policy "mathblast_scores: family insert" on mathblast_scores for insert with check (profile_id = any(select my_profile_ids()));
