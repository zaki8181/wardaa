export type RoleKey = 'مشرف العام' | 'مراقب العام' | 'مسؤل الخلية' | 'مراقب القسم';

export type BranchKey = 'حي محمدي' | 'عين السبع' | 'روش نوار';

export type VoterType = 'الناخبون' | 'متعاطف';

export type ReportType = 'voters_count' | 'details';

export type Profile = {
  id: string;
  role: RoleKey;
  parent_id: string | null;
  branch: BranchKey | null;
  full_name: string;
  phone_number: string | null;
  prefecture: string | null;
  region: string | null;
  party_duty: string | null;
  school: string | null;
  voter_number: string | null;
  section: string | null;
  created_at: string;
  updated_at: string;
  email?: string;
};

export type Voter = {
  id: string;
  branch: BranchKey;
  full_name: string;
  national_id: string | null;
  voter_number: string | null;
  school: string | null;
  section: string | null;
  type: VoterType;
  added_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VoteReport = {
  id: string;
  submitted_by: string;
  section: string;
  branch: BranchKey;
  report_type: ReportType;
  voters_count: number | null;
  total_registered: number | null;
  warda_votes: number | null;
  cancelled_votes: number;
  submitted_at: string;
};
