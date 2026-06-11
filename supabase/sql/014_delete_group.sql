-- Delete a group (owner-only, only if no other members remain)
CREATE OR REPLACE FUNCTION public.delete_group(target_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.groups WHERE id = target_group_id AND owner_id = requester)
  THEN RAISE EXCEPTION 'Only the owner can delete the group'; END IF;

  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND user_id <> requester)
  THEN RAISE EXCEPTION 'Cannot delete group with other members'; END IF;

  DELETE FROM public.group_members WHERE group_id = target_group_id;
  DELETE FROM public.groups WHERE id = target_group_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.delete_group(uuid) TO authenticated;
