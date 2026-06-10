-- Add group label column to matches (e.g. 'A', 'B', ... 'L')
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS group_label text DEFAULT NULL;
