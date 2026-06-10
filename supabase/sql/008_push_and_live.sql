-- Phase 4: Push subscriptions + match events for live feed.

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Match events table (for live feed timeline)
CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id int NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('goal', 'kickoff', 'halftime', 'fulltime', 'red_card')),
  minute int,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON public.match_events(match_id, created_at);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_events_read_authenticated ON public.match_events
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
