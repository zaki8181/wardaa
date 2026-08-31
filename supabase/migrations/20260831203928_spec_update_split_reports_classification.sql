/*
# Spec update: split reports + voter classification

1. vote_reports: add report_type + cancelled_votes, make counts nullable, fix constraints
2. voters: migrate type to الناخبون/متعاطف, drop status column constraints and column itself
*/

-- vote_reports: add columns
ALTER TABLE public.vote_reports ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'details' CHECK (report_type IN ('voters_count', 'details'));
ALTER TABLE public.vote_reports ADD COLUMN IF NOT EXISTS cancelled_votes integer NOT NULL DEFAULT 0 CHECK (cancelled_votes >= 0);

ALTER TABLE public.vote_reports ALTER COLUMN voters_count DROP NOT NULL;
ALTER TABLE public.vote_reports ALTER COLUMN total_registered DROP NOT NULL;
ALTER TABLE public.vote_reports ALTER COLUMN warda_votes DROP NOT NULL;

-- Drop ALL check constraints on vote_reports
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.vote_reports'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.vote_reports DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.vote_reports ADD CONSTRAINT vr_voters_nn CHECK (voters_count IS NULL OR voters_count >= 0);
ALTER TABLE public.vote_reports ADD CONSTRAINT vr_total_nn CHECK (total_registered IS NULL OR total_registered >= 0);
ALTER TABLE public.vote_reports ADD CONSTRAINT vr_warda_nn CHECK (warda_votes IS NULL OR warda_votes >= 0);
ALTER TABLE public.vote_reports ADD CONSTRAINT vr_cancelled_nn CHECK (cancelled_votes >= 0);
ALTER TABLE public.vote_reports ADD CONSTRAINT vr_rtype CHECK (report_type IN ('voters_count', 'details'));

-- voters: drop ALL check constraints first
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.voters'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.voters DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Migrate data
UPDATE public.voters SET type = 'الناخبون' WHERE type NOT IN ('الناخبون', 'متعاطف');
UPDATE public.voters SET type = 'الناخبون' WHERE type IS NULL;

-- Add new type constraint
ALTER TABLE public.voters ALTER COLUMN type SET DEFAULT 'الناخبون';
ALTER TABLE public.voters ADD CONSTRAINT voters_type_chk CHECK (type IN ('الناخبون', 'متعاطف'));

-- Drop status column (no longer needed — classification replaces it)
ALTER TABLE public.voters DROP COLUMN IF EXISTS status;