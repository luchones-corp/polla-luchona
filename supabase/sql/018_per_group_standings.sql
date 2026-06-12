-- Update standings view and all RPCs to score each prediction against
-- its own group, now that predictions are per-group.

-- group_standings view
CREATE OR REPLACE VIEW public.group_standings
WITH (security_invoker = false)
AS
SELECT
  gm.group_id,
  gm.user_id,
  p.display_name,
  COALESCE(SUM(
    CASE
      WHEN m.status = 'finished' AND pr.score_home IS NOT NULL AND pr.score_away IS NOT NULL
           AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 3
      WHEN m.status = 'finished' AND pr.pick = m.outcome THEN 1
      ELSE 0
    END
  ), 0)::int AS points,
  COUNT(*) FILTER (
    WHERE m.status = 'finished'
      AND pr.score_home IS NOT NULL AND pr.score_away IS NOT NULL
      AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away
  )::int AS exact_count,
  MAX(m.kickoff_at) FILTER (
    WHERE m.status = 'finished' AND pr.pick = m.outcome
  ) AS last_correct_at
FROM public.group_members gm
JOIN public.profiles p ON p.id = gm.user_id
LEFT JOIN public.predictions pr
  ON pr.user_id = gm.user_id AND pr.group_id = gm.group_id
LEFT JOIN public.matches m ON m.id = pr.match_id
GROUP BY gm.group_id, gm.user_id, p.display_name;

-- get_stage_standings
CREATE OR REPLACE FUNCTION public.get_stage_standings(
  target_group_id uuid,
  target_stage text DEFAULT NULL
)
RETURNS TABLE (
  group_id uuid,
  user_id uuid,
  display_name text,
  points int,
  exact_count int,
  last_correct_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = requester
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    gm.group_id,
    gm.user_id,
    p.display_name,
    COALESCE(SUM(
      CASE
        WHEN m.status = 'finished'
             AND (target_stage IS NULL OR m.stage = target_stage)
             AND pr.score_home IS NOT NULL AND pr.score_away IS NOT NULL
             AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 3
        WHEN m.status = 'finished'
             AND (target_stage IS NULL OR m.stage = target_stage)
             AND pr.pick = m.outcome THEN 1
        ELSE 0
      END
    ), 0)::int AS points,
    COUNT(*) FILTER (
      WHERE m.status = 'finished'
        AND (target_stage IS NULL OR m.stage = target_stage)
        AND pr.score_home IS NOT NULL AND pr.score_away IS NOT NULL
        AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away
    )::int AS exact_count,
    MAX(m.kickoff_at) FILTER (
      WHERE m.status = 'finished'
        AND (target_stage IS NULL OR m.stage = target_stage)
        AND pr.pick = m.outcome
    ) AS last_correct_at
  FROM public.group_members gm
  JOIN public.profiles p ON p.id = gm.user_id
  LEFT JOIN public.predictions pr
    ON pr.user_id = gm.user_id AND pr.group_id = gm.group_id
  LEFT JOIN public.matches m ON m.id = pr.match_id
  WHERE gm.group_id = target_group_id
  GROUP BY gm.group_id, gm.user_id, p.display_name;
END;
$$;

-- get_leaderboard_history
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
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
    LEFT JOIN public.predictions pr
      ON pr.user_id = gm.user_id AND pr.group_id = gm.group_id AND pr.match_id = m.id
    WHERE gm.group_id = target_group_id
      AND m.status = 'finished'
  ) sub
  ORDER BY sub.user_id, sub.kickoff_at, sub.match_id;
END;
$$;

-- get_group_predictions: only show this group's picks
CREATE OR REPLACE FUNCTION public.get_group_predictions(target_group_id uuid)
RETURNS TABLE (
  match_id int,
  user_id uuid,
  display_name text,
  pick text,
  score_home int,
  score_away int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = requester
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT pr.match_id, pr.user_id, p.display_name, pr.pick, pr.score_home, pr.score_away
  FROM public.predictions pr
  JOIN public.profiles p ON p.id = pr.user_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE pr.group_id = target_group_id
    AND m.kickoff_at <= now();
END;
$$;

-- get_user_predictions_in_group: scope to this group only
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
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id AND gm.user_id = requester
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;
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
    AND pr.group_id = target_group_id
    AND m.kickoff_at <= now();
END;
$$;

-- archive_group: count predictions in this group only
CREATE OR REPLACE FUNCTION public.archive_group(target_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
  standings_json jsonb;
  stats_json jsonb;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = target_group_id AND g.owner_id = requester
  ) THEN
    RAISE EXCEPTION 'Only the group owner can archive';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', gs.user_id,
      'display_name', gs.display_name,
      'points', gs.points,
      'exact_count', gs.exact_count
    ) ORDER BY gs.points DESC, gs.exact_count DESC
  ), '[]'::jsonb)
  INTO standings_json
  FROM public.group_standings gs
  WHERE gs.group_id = target_group_id;

  SELECT jsonb_build_object(
    'total_predictions', COALESCE(pred_count, 0),
    'total_members', COALESCE(member_count, 0)
  )
  INTO stats_json
  FROM (
    SELECT
      (SELECT COUNT(*) FROM public.predictions pr WHERE pr.group_id = target_group_id) AS pred_count,
      (SELECT COUNT(*) FROM public.group_members WHERE group_id = target_group_id) AS member_count
  ) sub;

  INSERT INTO public.group_archives (group_id, season, final_standings, stats)
  VALUES (target_group_id, '2026', standings_json, stats_json)
  ON CONFLICT (group_id, season) DO UPDATE
  SET final_standings = EXCLUDED.final_standings,
      stats = EXCLUDED.stats,
      archived_at = now();
END;
$$;
