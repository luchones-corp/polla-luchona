-- Phase 6: Prediction deadline extension per group

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS lock_minutes_before int NOT NULL DEFAULT 0
  CHECK (lock_minutes_before >= 0 AND lock_minutes_before <= 1440);
