-- Phase 1: Exact score predictions + tiebreaker rules
-- Scoring: 3 pts for exact score match, 1 pt for correct outcome only, 0 otherwise.

-- 1. Add exact-score columns to predictions
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS score_home int DEFAULT NULL CHECK (score_home >= 0),
  ADD COLUMN IF NOT EXISTS score_away int DEFAULT NULL CHECK (score_away >= 0);

-- 2. Replace group_standings view with new scoring + tiebreaker columns
CREATE OR REPLACE VIEW public.group_standings
WITH (security_invoker = true)
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
LEFT JOIN public.predictions pr ON pr.user_id = gm.user_id
LEFT JOIN public.matches m ON m.id = pr.match_id
GROUP BY gm.group_id, gm.user_id, p.display_name;

-- 3. Update get_stage_standings to match new scoring
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
  LEFT JOIN public.predictions pr ON pr.user_id = gm.user_id
  LEFT JOIN public.matches m ON m.id = pr.match_id
  WHERE gm.group_id = target_group_id
  GROUP BY gm.group_id, gm.user_id, p.display_name;
END;
$$;

-- 4. Update get_group_predictions to return exact scores
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
  SELECT pr.match_id, pr.user_id, p.display_name, pr.pick, pr.score_home, pr.score_away
  FROM public.predictions pr
  JOIN public.group_members gm ON gm.user_id = pr.user_id AND gm.group_id = target_group_id
  JOIN public.profiles p ON p.id = pr.user_id
  JOIN public.matches m ON m.id = pr.match_id
  WHERE m.kickoff_at <= now();
END;
$$;
