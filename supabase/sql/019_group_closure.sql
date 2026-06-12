-- Group closure: owner can lock a group so the invite link rejects new joiners.
-- Existing members can still re-join (idempotent), but no one new can enter.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

-- Owner-only RPC to flip the flag
CREATE OR REPLACE FUNCTION public.set_group_closed(target_group_id uuid, closed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  UPDATE public.groups
  SET is_closed = closed
  WHERE id = target_group_id AND owner_id = requester;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the group owner can change closure';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_group_closed(uuid, boolean) TO authenticated;

-- Block new joiners when closed (current members can still call this idempotently)
CREATE OR REPLACE FUNCTION public.join_group_by_token(token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester uuid := auth.uid();
  target_group_id uuid;
  is_closed_flag boolean;
  already_member boolean;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT g.id, g.is_closed INTO target_group_id, is_closed_flag
  FROM public.groups g
  WHERE g.invite_token = token;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite link';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = target_group_id AND user_id = requester
  ) INTO already_member;

  IF is_closed_flag AND NOT already_member THEN
    RAISE EXCEPTION 'GROUP_CLOSED';
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (target_group_id, requester)
  ON CONFLICT DO NOTHING;

  RETURN target_group_id;
END;
$$;

DROP FUNCTION get_group_by_invite_token(text);
-- Surface is_closed on the invite preview screen
CREATE OR REPLACE FUNCTION public.get_group_by_invite_token(token text)
RETURNS TABLE (id uuid, name text, owner_id uuid, is_closed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.name, g.owner_id, g.is_closed
  FROM public.groups g
  WHERE g.invite_token = token;
END;
$$;
