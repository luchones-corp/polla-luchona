-- Per-group predictions: predictions now belong to (user, group, match).
-- Each user can have a different prediction in each group they belong to.
-- Existing predictions are duplicated across every group the user is in.

-- 1. Add group_id (nullable while we backfill)
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE;

-- 2. Drop the old (user_id, match_id) unique constraint so backfill can insert duplicates
ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_user_id_match_id_key;
DROP INDEX IF EXISTS public.idx_predictions_user_match;

-- 3. Backfill: for each legacy prediction, assign it to one of the user's groups,
--    and INSERT new rows for any additional groups the user belongs to.
DO $$
DECLARE
  pred record;
  gm record;
  first_done boolean;
BEGIN
  FOR pred IN
    SELECT id, user_id, match_id, pick, score_home, score_away
    FROM public.predictions
    WHERE group_id IS NULL
  LOOP
    first_done := false;
    FOR gm IN SELECT group_id FROM public.group_members WHERE user_id = pred.user_id LOOP
      IF NOT first_done THEN
        UPDATE public.predictions SET group_id = gm.group_id WHERE id = pred.id;
        first_done := true;
      ELSE
        INSERT INTO public.predictions (user_id, group_id, match_id, pick, score_home, score_away)
        VALUES (pred.user_id, gm.group_id, pred.match_id, pred.pick, pred.score_home, pred.score_away);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 4. Anything still NULL means the user wasn't in any group — drop it
DELETE FROM public.predictions WHERE group_id IS NULL;

-- 5. Enforce NOT NULL + new unique (user, group, match)
ALTER TABLE public.predictions ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_user_group_match_key UNIQUE (user_id, group_id, match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_group_match
  ON public.predictions(user_id, group_id, match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_group_match
  ON public.predictions(group_id, match_id);

-- 6. Update RLS: insert/update must reference a group the user belongs to
DROP POLICY IF EXISTS predictions_insert_own_before_kickoff ON public.predictions;
CREATE POLICY predictions_insert_own_before_kickoff
ON public.predictions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.kickoff_at > now()
  )
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = predictions.group_id AND gm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS predictions_update_own_before_kickoff ON public.predictions;
CREATE POLICY predictions_update_own_before_kickoff
ON public.predictions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.kickoff_at > now()
  )
  AND EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = predictions.group_id AND gm.user_id = auth.uid()
  )
);
