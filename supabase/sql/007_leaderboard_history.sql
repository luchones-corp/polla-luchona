-- Phase 3: Leaderboard history — cumulative points per user per match.

CREATE OR REPLACE FUNCTION public.get_leaderboard_history(target_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  match_id int,
  kickoff_at timestamptz,
  cumulative_points int
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

  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = requester
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    sub.user_id,
    sub.display_name,
    sub.match_id,
    sub.kickoff_at,
    (SUM(sub.pts) OVER (PARTITION BY sub.user_id ORDER BY sub.kickoff_at, sub.match_id))::int AS cumulative_points
  FROM (
    SELECT
      gm.user_id,
      p.display_name,
      m.id AS match_id,
      m.kickoff_at,
      CASE
        WHEN m.status = 'finished' AND pr.score_home IS NOT NULL AND pr.score_away IS NOT NULL
             AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 3
        WHEN m.status = 'finished' AND pr.pick = m.outcome THEN 1
        ELSE 0
      END AS pts
    FROM public.group_members gm
    JOIN public.profiles p ON p.id = gm.user_id
    CROSS JOIN public.matches m
    LEFT JOIN public.predictions pr ON pr.user_id = gm.user_id AND pr.match_id = m.id
    WHERE gm.group_id = target_group_id
      AND m.status = 'finished'
  ) sub
  ORDER BY sub.user_id, sub.kickoff_at, sub.match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard_history(uuid) TO authenticated;
