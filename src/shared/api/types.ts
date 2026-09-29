export type ReportStatus = 'received' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export type ProjectStatus = 'planned' | 'procurement' | 'in_progress' | 'stalled' | 'completed';
export type TenderStatus = 'open' | 'evaluating' | 'awarded' | 'cancelled';
export type Channel = 'web' | 'ussd' | 'sms' | 'ivr' | 'voice';

/** One row of public.public_ward_stats */
export type WardStat = {
  ward_id: string;
  name: string;
  sub_county_id: string | null;
  constituency: string;
  population: number | null;
  open_reports: number;
  overdue_reports: number;
  resolved_90d: number;
  projects: number;
  projects_completed: number;
  votes_cast: number;
  trust_index: number | null;
};

/** public.public_county_summary */
export type CountySummary = {
  votes_cast: number;
  reports_filed: number;
  reports_resolved: number;
  reports_overdue: number;
  milestones_hit: number;
  projects_published: number;
};

export type Milestone = { title: string; due: string | null; done: boolean };

/** public.public_projects */
export type PublicProject = {
  id: string;
  slug: string;
  ward_id: string;
  ward_name: string;
  title: string;
  sector: string;
  description: string | null;
  status: ProjectStatus;
  budget: number;
  spent: number;
  contractor: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string | null;
  expected_at: string | null;
  completed_at: string | null;
  milestones: Milestone[];
  photos: { path: string; caption: string | null }[];
};

/** public.public_tenders */
export type PublicTender = {
  id: string;
  reference: string;
  title: string;
  ward_id: string | null;
  ward_name: string | null;
  sector: string;
  status: TenderStatus;
  estimated_budget: number;
  applicants_count: number;
  awarded_to: string | null;
  published_at: string | null;
  closes_at: string | null;
};

/** Result of public.case_status(reference) */
export type CaseStatus = {
  reference: string;
  status: ReportStatus;
  category: string | null;
  category_sw: string | null;
  category_id?: string | null;
  ward: string;
  ward_id: string;
  created_at: string;
  updated_at: string;
  resolve_due_at: string | null;
  project_slug: string | null;
  events: { kind: string; message: string | null; at: string }[];
};

export type ActivityItem = { id: string; kind: 'report' | 'resolved' | 'milestone' | 'vote' | 'tender'; ward: string; text: string; at: string };

export type DataSource = 'live' | 'demo';

export type BudgetCycle = { id: string; title: string; status: 'draft' | 'open' | 'closed'; starts_at: string; ends_at: string; published_results: boolean };
export type ProjectOption = { id: string; cycle_id: string; ward_id: string; title: string; sector: string; description: string | null; amount: number };
export type VoteData = { cycle: BudgetCycle | null; envelope: number | null; options: ProjectOption[]; tally: Record<string, number> };

export type Proposal = {
  id: string;
  ward_id: string | null;
  kind: 'proposal' | 'petition';
  title: string;
  body: string;
  status: 'submitted' | 'under_review' | 'accepted' | 'declined' | 'merged';
  response: string | null;
  supporters: number;
  created_at: string;
};

export type PulseSummary = {
  weekly: { week: string; filed: number; resolved: number }[];
  by_category: { category_id: string; total: number; open: number }[];
  by_channel: Record<string, number>;
  median_ack_hours: number | null;
  median_resolve_days: number | null;
};
