-- Phase 2: User profile — fetch another user's predictions for finished matches (within same group).

CREATE OR REPLACE FUNCTION public.get_user_predictions_in_group(
  target_user_id uuid,
  target_group_id uuid
)
RETURNS TABLE (
  match_id int,
  pick text,
  score_home int,
  score_away int,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Requester must be in the same group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = requester
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Target must also be in the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this group';
  END IF;

  RETURN QUERY
  SELECT pr.match_id, pr.pick, pr.score_home, pr.score_away, pr.updated_at
  FROM public.predictions pr
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pr.user_id = target_user_id
    AND m.kickoff_at <= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_predictions_in_group(uuid, uuid) TO authenticated;
