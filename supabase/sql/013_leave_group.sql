-- Allow non-owner members to leave a group voluntarily.

CREATE OR REPLACE FUNCTION public.leave_group(target_group_id uuid)
RETURNS void
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

  IF EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = target_group_id AND owner_id = requester
  ) THEN
    RAISE EXCEPTION 'Owner cannot leave the group';
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = target_group_id AND user_id = requester;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_group(uuid) TO authenticated;
