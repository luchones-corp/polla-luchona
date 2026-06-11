-- Fix: group_standings view was using security_invoker = true, which meant
-- RLS on the predictions table filtered out other users' predictions
-- (predictions_select_own policy: user_id = auth.uid()).
-- This caused all users except the caller to show 0 points.
--
-- The fix removes security_invoker so the view runs as the view owner,
-- matching the behavior of get_stage_standings (SECURITY DEFINER).

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
LEFT JOIN public.predictions pr ON pr.user_id = gm.user_id
LEFT JOIN public.matches m ON m.id = pr.match_id
GROUP BY gm.group_id, gm.user_id, p.display_name;
