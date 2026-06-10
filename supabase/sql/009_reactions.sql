-- Phase 5: Match reactions

CREATE TABLE IF NOT EXISTS public.match_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id int NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('goal', 'fire', 'cry', 'laugh', 'shock', 'clap')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, group_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_match_reactions_match_group ON public.match_reactions(match_id, group_id);

ALTER TABLE public.match_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_reactions_select_member ON public.match_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = match_reactions.group_id AND gm.user_id = auth.uid()
  ));

CREATE POLICY match_reactions_insert_member ON public.match_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = match_reactions.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY match_reactions_delete_own ON public.match_reactions FOR DELETE
  USING (user_id = auth.uid());

-- RPC to get aggregated reactions for a group
CREATE OR REPLACE FUNCTION public.get_group_reactions(target_group_id uuid)
RETURNS TABLE (
  match_id int,
  emoji text,
  count bigint,
  user_reacted boolean
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
    mr.match_id,
    mr.emoji,
    COUNT(*)::bigint AS count,
    BOOL_OR(mr.user_id = requester) AS user_reacted
  FROM public.match_reactions mr
  WHERE mr.group_id = target_group_id
  GROUP BY mr.match_id, mr.emoji;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_reactions(uuid) TO authenticated;
