create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id int primary key,
  name text not null,
  logo_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id int primary key,
  stage text not null default 'group' check (stage in ('group', 'r32', 'r16', 'qf', 'sf', 'final')),
  home_team_id int references public.teams(id),
  away_team_id int references public.teams(id),
  kickoff_at timestamptz not null,
  ft_home int,
  ft_away int,
  outcome text check (outcome in ('HOME', 'DRAW', 'AWAY')),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id int not null references public.matches(id) on delete cascade,
  pick text not null check (pick in ('HOME', 'DRAW', 'AWAY')),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_groups_owner_id on public.groups(owner_id);
create index if not exists idx_predictions_user_match on public.predictions(user_id, match_id);
create index if not exists idx_matches_kickoff on public.matches(kickoff_at);
create index if not exists idx_matches_status on public.matches(status);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_invite_token()
returns text
language sql
as $$
  select encode(gen_random_bytes(16), 'hex');
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

drop trigger if exists touch_groups_updated_at on public.groups;
create trigger touch_groups_updated_at
before update on public.groups
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_teams_updated_at on public.teams;
create trigger touch_teams_updated_at
before update on public.teams
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_matches_updated_at on public.matches;
create trigger touch_matches_updated_at
before update on public.matches
for each row execute procedure public.touch_updated_at();

drop trigger if exists touch_predictions_updated_at on public.predictions;
create trigger touch_predictions_updated_at
before update on public.predictions
for each row execute procedure public.touch_updated_at();

create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  inserted_group public.groups;
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(group_name)) = 0 then
    raise exception 'Group name is required';
  end if;

  insert into public.groups (name, owner_id, invite_token)
  values (trim(group_name), requester, public.generate_invite_token())
  returning * into inserted_group;

  insert into public.group_members (group_id, user_id)
  values (inserted_group.id, requester)
  on conflict do nothing;

  return inserted_group;
end;
$$;

create or replace function public.get_group_by_invite_token(token text)
returns table (id uuid, name text, owner_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select g.id, g.name, g.owner_id
  from public.groups g
  where g.invite_token = token;
end;
$$;

create or replace function public.join_group_by_token(token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  target_group_id uuid;
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  select g.id into target_group_id
  from public.groups g
  where g.invite_token = token;

  if target_group_id is null then
    raise exception 'Invalid invite link';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target_group_id, requester)
  on conflict do nothing;

  return target_group_id;
end;
$$;

create or replace function public.regenerate_group_invite_token(target_group_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  new_token text := public.generate_invite_token();
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  update public.groups
  set invite_token = new_token
  where id = target_group_id and owner_id = requester;

  if not found then
    raise exception 'Only owner can regenerate invite token';
  end if;

  return new_token;
end;
$$;

create or replace function public.remove_group_member(target_group_id uuid, target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
begin
  if requester is null then
    raise exception 'Not authenticated';
  end if;

  if requester = target_member_id then
    raise exception 'Owner cannot remove themselves';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = target_group_id and g.owner_id = requester
  ) then
    raise exception 'Only owner can remove members';
  end if;

  delete from public.group_members gm
  where gm.group_id = target_group_id and gm.user_id = target_member_id;
end;
$$;

create or replace view public.group_standings
with (security_invoker = true)
as
select
  gm.group_id,
  gm.user_id,
  p.display_name,
  count(*) filter (
    where pr.pick = m.outcome and m.status = 'finished'
  )::int as points
from public.group_members gm
join public.profiles p on p.id = gm.user_id
left join public.predictions pr on pr.user_id = gm.user_id
left join public.matches m on m.id = pr.match_id
group by gm.group_id, gm.user_id, p.display_name;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.predictions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists teams_read_authenticated on public.teams;
create policy teams_read_authenticated
on public.teams
for select
using (auth.role() = 'authenticated');

drop policy if exists matches_read_authenticated on public.matches;
create policy matches_read_authenticated
on public.matches
for select
using (auth.role() = 'authenticated');

drop policy if exists groups_select_member on public.groups;
create policy groups_select_member
on public.groups
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists groups_update_owner on public.groups;
create policy groups_update_owner
on public.groups
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists group_members_select_same_group on public.group_members;
create policy group_members_select_same_group
on public.group_members
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  )
);

drop policy if exists predictions_select_own on public.predictions;
create policy predictions_select_own
on public.predictions
for select
using (user_id = auth.uid());

drop policy if exists predictions_insert_own_before_kickoff on public.predictions;
create policy predictions_insert_own_before_kickoff
on public.predictions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
  )
);

drop policy if exists predictions_update_own_before_kickoff on public.predictions;
create policy predictions_update_own_before_kickoff
on public.predictions
for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.kickoff_at > now()
  )
);

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.get_group_by_invite_token(text) to authenticated;
grant execute on function public.join_group_by_token(text) to authenticated;
grant execute on function public.regenerate_group_invite_token(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

grant select on public.group_standings to authenticated;
