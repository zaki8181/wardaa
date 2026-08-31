-- Add indexes for voter search columns (national_id, voter_number) and composite branch+type
CREATE INDEX IF NOT EXISTS voters_branch_type_idx ON public.voters(branch, type);
CREATE INDEX IF NOT EXISTS voters_national_id_idx ON public.voters(national_id);
CREATE INDEX IF NOT EXISTS voters_voter_number_idx ON public.voters(voter_number);
CREATE INDEX IF NOT EXISTS vr_branch_section_type_idx ON public.vote_reports(branch, section, report_type, submitted_at DESC);

-- Drop the old voters_status_idx (status column was dropped in prior migration)
DROP INDEX IF EXISTS public.voters_status_idx;