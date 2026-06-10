-- Phase 7: Seasonal Archive
-- Note: Ghost bot feature removed — inserting into profiles requires a matching
-- auth.users entry, which can't be done via SQL Editor alone.

-- Seasonal archive table
CREATE TABLE IF NOT EXISTS public.group_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  season text NOT NULL DEFAULT '2026',
  archived_at timestamptz NOT NULL DEFAULT now(),
  final_standings jsonb NOT NULL DEFAULT '[]',
  stats jsonb NOT NULL DEFAULT '{}',
  UNIQUE (group_id, season)
);

ALTER TABLE public.group_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_archives_select_member ON public.group_archives FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_archives.group_id AND gm.user_id = auth.uid()
  ));

-- RPC to archive a group (owner only)
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
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = target_group_id AND g.owner_id = requester
  ) THEN
    RAISE EXCEPTION 'Only the group owner can archive';
  END IF;

  -- Build final standings
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

  -- Build stats
  SELECT jsonb_build_object(
    'total_predictions', COALESCE(pred_count, 0),
    'total_members', COALESCE(member_count, 0)
  )
  INTO stats_json
  FROM (
    SELECT
      (SELECT COUNT(*) FROM public.predictions pr
       JOIN public.group_members gm ON gm.user_id = pr.user_id AND gm.group_id = target_group_id) AS pred_count,
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

GRANT EXECUTE ON FUNCTION public.archive_group(uuid) TO authenticated;
