-- Fetch all group members' predictions for matches that have started.
-- Used for prediction reveal on fixture cards and head-to-head comparison.
create or replace function public.get_group_predictions(target_group_id uuid)
returns table (
  match_id int,
  user_id uuid,
  display_name text,
  pick text
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
  select pr.match_id, pr.user_id, p.display_name, pr.pick
  from public.predictions pr
  join public.group_members gm on gm.user_id = pr.user_id and gm.group_id = target_group_id
  join public.profiles p on p.id = pr.user_id
  join public.matches m on m.id = pr.match_id
  where m.kickoff_at <= now();
end;
$$;

grant execute on function public.get_group_predictions(uuid) to authenticated;
