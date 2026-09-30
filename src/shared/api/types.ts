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
  procurement_method?: ProcurementMethod;
  award_amount?: number | null;
  awarded_at?: string | null;
  contractor_id?: string | null;
};

export type ProcurementMethod = 'open_tender' | 'restricted' | 'request_for_quotation' | 'direct' | 'framework';

/** public.procurement_watch(): who wins county money, how, and which patterns deserve a closer look. */
export type FlagSeverity = 'info' | 'watch' | 'high';
export type FlagStatus = 'open' | 'reviewing' | 'explained' | 'referred' | 'cleared';
export type ProcurementFlag = {
  code: string;
  severity: FlagSeverity;
  subject_kind: 'county' | 'contractor' | 'tender' | 'project';
  subject_key: string;
  subject_label: string;
  title: string;
  detail: string;
  metrics: Record<string, number | string | null>;
  status: FlagStatus;
  response: string | null;
  first_seen: string | null;
};
export type ProcurementContractor = { id: string; name: string; wins: number; value: number; share_value: number; share_count: number; non_open: number; single_bid: number; last_award: string | null };
export type ProcurementSummary = {
  awarded_count: number;
  awarded_value: number;
  suppliers: number;
  hhi: number;
  hhi_band: 'low' | 'moderate' | 'high';
  top1_share: number;
  top3_share: number;
  top5_share: number;
  non_competitive_share: number;
  single_bid_share: number;
  avg_bids: number | null;
  avg_tender_days: number | null;
};
export type ProcurementWatch = {
  generated_at: string;
  summary: ProcurementSummary;
  contractors: ProcurementContractor[];
  methods: { method: ProcurementMethod; awards: number; value: number }[];
  flags: ProcurementFlag[];
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
  reopened_count?: number;
  feedback_given?: boolean;
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

// ---- the resident loop (feedback, verification, results, follows, scorecards, open data) ----

export type FixStats = { responses: number; fixed: number; reopened: number; by_ward: { ward_id: string; ward: string; responses: number; fixed: number }[] };

export type VerifyResult = {
  kind: 'permit' | 'receipt' | null;
  valid: boolean;
  state?: 'valid' | 'revoked' | 'not_valid' | 'unknown';
  service?: string | null;
  holder?: string | null;
  ward?: string | null;
  amount?: number | null;
  stream?: string | null;
  issued_at?: string | null;
  reference?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
};

export type BudgetResultOption = { id: string; title: string; sector: string; amount: number; votes: number; funded: boolean };
export type BudgetResults = {
  cycle: { id: string; title: string; starts_at: string; ends_at: string; status: string } | null;
  cycles: { id: string; title: string }[];
  total_votes?: number;
  wards: { ward_id: string; ward: string; envelope: number; votes: number; options: BudgetResultOption[] }[];
};

export type FollowKind = 'supplier' | 'project' | 'ward_tenders' | 'sector';
export type Follow = { id: string; kind: FollowKind; key: string; label: string; created_at: string };

export type CommitteeView = {
  code: string;
  name: string;
  name_sw: string | null;
  cases: { received_90d: number; open: number; overdue: number; resolved_90d: number; reopened: number; median_days: number | null };
  projects: { count: number; budget: number; spent: number; stalled: number; completed: number };
  tenders: { open: number; awarded: number; awarded_value: number };
  flags: number;
  attention: { slug: string; title: string; status: string; budget: number; spent: number }[];
};

export type WardScorecard = {
  ward_id: string;
  ward: string;
  constituency: string;
  population: number | null;
  sub_county: string | null;
  generated_at: string;
  cases: { received_90d: number; resolved_90d: number; open: number; overdue: number; median_days: number | null; reopened: number };
  confirmed: { responses: number; fixed: number };
  top_categories: { category: string; category_sw: string | null; count: number }[];
  projects: { count: number; budget: number; spent: number; stalled: number; completed: number };
  tenders: { open: number; awarded: number; awarded_value: number };
  budget: { cycle: string; votes: number; envelope: number | null } | null;
};

export type OcdsPackage = { uri: string; version: string; publishedDate: string; publisher: { name: string }; license: string; releases: Record<string, unknown>[] };
