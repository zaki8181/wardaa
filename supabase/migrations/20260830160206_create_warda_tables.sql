/*
# Warda Digital Election Monitoring System — Tables & Indexes

Creates the three core tables for the election monitoring platform:
profiles (user hierarchy), voters (voter records), vote_reports (field submissions).

1. Tables
  - `profiles` — user profiles linked to auth.users, with role hierarchy
  - `voters` — voter records per branch with status tracking
  - `vote_reports` — timestamped vote count submissions

2. Triggers
  - updated_at auto-set on profiles and voters
  - First auth user auto-becomes مشرف العام
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('مشرف العام', 'مراقب العام', 'مسؤل الخلية', 'مراقب القسم')),
  parent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch text CHECK (branch IN ('حي محمدي', 'عين السبع', 'روش نوار') OR branch IS NULL),
  full_name text NOT NULL DEFAULT '',
  phone_number text,
  prefecture text,
  region text,
  party_duty text,
  school text,
  voter_number text,
  section text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE INDEX IF NOT EXISTS profiles_parent_idx ON public.profiles(parent_id);
CREATE INDEX IF NOT EXISTS profiles_branch_idx ON public.profiles(branch);

-- VOTERS
CREATE TABLE IF NOT EXISTS public.voters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL CHECK (branch IN ('حي محمدي', 'عين السبع', 'روش نوار')),
  full_name text NOT NULL,
  national_id text,
  voter_number text,
  school text,
  section text,
  type text NOT NULL DEFAULT 'مصوّت' CHECK (type IN ('متعاطف', 'مصوّت')),
  status text NOT NULL DEFAULT 'لم يصوّت' CHECK (status IN ('لم يصوّت', 'صوّت')),
  added_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voters_branch_idx ON public.voters(branch);
CREATE INDEX IF NOT EXISTS voters_section_idx ON public.voters(section);
CREATE INDEX IF NOT EXISTS voters_status_idx ON public.voters(status);
CREATE INDEX IF NOT EXISTS voters_type_idx ON public.voters(type);
CREATE INDEX IF NOT EXISTS voters_name_idx ON public.voters(full_name);

-- VOTE REPORTS
CREATE TABLE IF NOT EXISTS public.vote_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  section text NOT NULL,
  branch text NOT NULL CHECK (branch IN ('حي محمدي', 'عين السبع', 'روش نوار')),
  voters_count integer NOT NULL CHECK (voters_count >= 0),
  total_registered integer NOT NULL CHECK (total_registered >= 0),
  warda_votes integer NOT NULL CHECK (warda_votes >= 0),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CHECK (voters_count <= total_registered),
  CHECK (warda_votes <= voters_count)
);

CREATE INDEX IF NOT EXISTS vr_branch_idx ON public.vote_reports(branch);
CREATE INDEX IF NOT EXISTS vr_section_idx ON public.vote_reports(section);
CREATE INDEX IF NOT EXISTS vr_submitted_by_idx ON public.vote_reports(submitted_by);
CREATE INDEX IF NOT EXISTS vr_submitted_at_idx ON public.vote_reports(submitted_at DESC);

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS voters_updated_at ON public.voters;
CREATE TRIGGER voters_updated_at BEFORE UPDATE ON public.voters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bootstrap first user as super admin
CREATE OR REPLACE FUNCTION public.handle_first_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) THEN
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (NEW.id, 'مشرف العام', COALESCE(NEW.raw_user_meta_data->>'full_name', 'المشرف العام'));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_user();