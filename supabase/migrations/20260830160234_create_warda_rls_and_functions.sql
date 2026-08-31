/*
# Warda Digital — Helper Functions, RLS Policies, Realtime

1. Helper Functions (SECURITY DEFINER)
  - get_my_role, get_my_branch, get_my_section — read caller's profile
  - is_in_subtree — walks parent_id chain for hierarchy checks

2. RLS Policies
  - profiles: hierarchy-scoped SELECT, blocked INSERT (edge fn only), 
    hierarchy-scoped UPDATE, super-admin-only DELETE
  - voters: branch/section-scoped access, INSERT blocked for مراقب القسم
  - vote_reports: مراقب القسم only INSERT/UPDATE, hierarchy-scoped SELECT

3. Column Privileges
  - role and parent_id on profiles REVOKED from anon/authenticated

4. Realtime
  - vote_reports added to supabase_realtime publication
*/

-- HELPER FUNCTIONS

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT branch FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_section()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT section FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_in_subtree(target_user_id uuid, root_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  cur uuid := target_user_id;
  i integer := 0;
BEGIN
  IF target_user_id IS NULL OR root_user_id IS NULL THEN RETURN false; END IF;
  IF target_user_id = root_user_id THEN RETURN true; END IF;
  LOOP
    SELECT parent_id INTO cur FROM public.profiles WHERE id = cur;
    IF cur IS NULL THEN RETURN false; END IF;
    IF cur = root_user_id THEN RETURN true; END IF;
    i := i + 1;
    IF i >= 10 THEN RETURN false; END IF;
  END LOOP;
END; $$;

-- ENABLE RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_reports ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES

DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
CREATE POLICY "select_profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.get_my_role() = 'مشرف العام'
  OR public.is_in_subtree(id, auth.uid())
);

DROP POLICY IF EXISTS "insert_profiles" ON public.profiles;
CREATE POLICY "insert_profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "update_profiles" ON public.profiles;
CREATE POLICY "update_profiles" ON public.profiles FOR UPDATE TO authenticated
USING (
  auth.uid() = id
  OR public.get_my_role() = 'مشرف العام'
  OR public.is_in_subtree(id, auth.uid())
)
WITH CHECK (
  auth.uid() = id
  OR public.get_my_role() = 'مشرف العام'
  OR public.is_in_subtree(id, auth.uid())
);

DROP POLICY IF EXISTS "delete_profiles" ON public.profiles;
CREATE POLICY "delete_profiles" ON public.profiles FOR DELETE TO authenticated
USING (public.get_my_role() = 'مشرف العام' AND auth.uid() != id);

REVOKE UPDATE (role, parent_id) ON public.profiles FROM anon, authenticated;

-- VOTERS POLICIES

DROP POLICY IF EXISTS "select_voters" ON public.voters;
CREATE POLICY "select_voters" ON public.voters FOR SELECT TO authenticated
USING (
  public.get_my_role() = 'مشرف العام'
  OR (
    branch = public.get_my_branch()
    AND (
      public.get_my_role() != 'مراقب القسم'
      OR section = public.get_my_section()
    )
  )
);

DROP POLICY IF EXISTS "insert_voters" ON public.voters;
CREATE POLICY "insert_voters" ON public.voters FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() IN ('مشرف العام', 'مراقب العام', 'مسؤل الخلية')
  AND (
    public.get_my_role() = 'مشرف العام'
    OR branch = public.get_my_branch()
  )
);

DROP POLICY IF EXISTS "update_voters" ON public.voters;
CREATE POLICY "update_voters" ON public.voters FOR UPDATE TO authenticated
USING (
  public.get_my_role() = 'مشرف العام'
  OR (
    branch = public.get_my_branch()
    AND (
      public.get_my_role() != 'مراقب القسم'
      OR section = public.get_my_section()
    )
  )
)
WITH CHECK (
  public.get_my_role() = 'مشرف العام'
  OR (
    branch = public.get_my_branch()
    AND (
      public.get_my_role() != 'مراقب القسم'
      OR section = public.get_my_section()
    )
  )
);

DROP POLICY IF EXISTS "delete_voters" ON public.voters;
CREATE POLICY "delete_voters" ON public.voters FOR DELETE TO authenticated
USING (public.get_my_role() = 'مشرف العام');

-- VOTE REPORTS POLICIES

DROP POLICY IF EXISTS "select_vote_reports" ON public.vote_reports;
CREATE POLICY "select_vote_reports" ON public.vote_reports FOR SELECT TO authenticated
USING (
  public.get_my_role() = 'مشرف العام'
  OR submitted_by = auth.uid()
  OR public.is_in_subtree(submitted_by, auth.uid())
);

DROP POLICY IF EXISTS "insert_vote_reports" ON public.vote_reports;
CREATE POLICY "insert_vote_reports" ON public.vote_reports FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role() = 'مراقب القسم'
  AND auth.uid() = submitted_by
);

DROP POLICY IF EXISTS "update_vote_reports" ON public.vote_reports;
CREATE POLICY "update_vote_reports" ON public.vote_reports FOR UPDATE TO authenticated
USING (
  public.get_my_role() = 'مراقب القسم'
  AND auth.uid() = submitted_by
)
WITH CHECK (
  public.get_my_role() = 'مراقب القسم'
  AND auth.uid() = submitted_by
);

DROP POLICY IF EXISTS "delete_vote_reports" ON public.vote_reports;
CREATE POLICY "delete_vote_reports" ON public.vote_reports FOR DELETE TO authenticated
USING (false);

-- REALTIME

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'vote_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_reports;
  END IF;
END; $$;