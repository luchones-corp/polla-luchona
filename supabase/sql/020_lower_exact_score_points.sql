-- Scoring change: exact score match now worth 2 pts (was 3). Outcome-only stays at 1 pt.
-- Points are computed on the fly by the view and RPCs below, so this migration
-- automatically restates every historical match under the new rule.

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
           AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 2
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
             AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 2
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
             AND pr.score_home = m.ft_home AND pr.score_away = m.ft_away THEN 2
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
