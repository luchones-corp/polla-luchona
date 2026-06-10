-- Standings filtered by match stage (or all if target_stage is null).
create or replace function public.get_stage_standings(
  target_group_id uuid,
  target_stage text default null
)
returns table (
  group_id uuid,
  user_id uuid,
  display_name text,
  points int
)
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

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = target_group_id and gm.user_id = requester
  ) then
    raise exception 'Not a member of this group';
  end if;

  return query
  select
    gm.group_id,
    gm.user_id,
    p.display_name,
    count(*) filter (
      where pr.pick = m.outcome
        and m.status = 'finished'
        and (target_stage is null or m.stage = target_stage)
    )::int as points
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.predictions pr on pr.user_id = gm.user_id
  left join public.matches m on m.id = pr.match_id
  where gm.group_id = target_group_id
  group by gm.group_id, gm.user_id, p.display_name;
end;
$$;

grant execute on function public.get_stage_standings(uuid, text) to authenticated;
