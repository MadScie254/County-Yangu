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
  supporters?: number;
  feedback_given?: boolean;
  events: { kind: string; message: string | null; at: string }[];
  /** Other issues filed in the same visit (linked cases). */
  group?: { reference: string; category_id: string | null; status: ReportStatus }[];
  /** Staff-taken before / after photos, public on purpose. */
  fix_photos?: { kind: 'before' | 'after'; path: string; caption: string | null; at: string }[];
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
  threshold_reached_at?: string | null;
  response_due_at?: string | null;
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

export type FollowKind = 'supplier' | 'project' | 'ward_tenders' | 'sector' | 'commitment';
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

export type MeetingKind = 'baraza' | 'budget_hearing' | 'assembly_sitting' | 'town_hall' | 'other';
export type PublicMeeting = {
  id: string;
  ward_id: string | null;
  kind: MeetingKind;
  title: string;
  title_sw: string | null;
  agenda: string | null;
  venue: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'cancelled' | 'held';
  outcome: string | null;
  attendance: number | null;
};

export type NoticeKind = 'water' | 'power' | 'road' | 'waste' | 'health' | 'other';
export type ServiceNotice = {
  id: string;
  ward_id: string | null;
  kind: NoticeKind;
  severity: 'info' | 'disruption' | 'emergency';
  title: string;
  title_sw: string | null;
  body: string | null;
  area: string | null;
  starts_at: string;
  ends_at: string | null;
  status: 'active' | 'resolved' | 'cancelled';
  resolved_at: string | null;
  resolved_note: string | null;
  updated_at: string;
};

export type CommitmentStatus = 'not_started' | 'in_progress' | 'delivered' | 'delayed' | 'dropped';
export type CommitmentUpdate = { id: number; commitment_id: string; status: CommitmentStatus; due_on: string | null; note: string | null; created_at: string };
export type Commitment = {
  id: string;
  slug: string;
  title: string;
  title_sw: string | null;
  detail: string | null;
  source: string;
  source_url: string | null;
  made_on: string | null;
  due_on: string | null;
  sector: string | null;
  ward_id: string | null;
  project_id: string | null;
  status: CommitmentStatus;
  evidence: string | null;
  updated_at: string;
  updates: CommitmentUpdate[];
};

export type InfoRequestStatus = 'submitted' | 'extended' | 'answered' | 'partly_answered' | 'refused' | 'withdrawn';
export type InfoRequest = {
  id: string;
  reference: string;
  requester_name: string | null;
  department_id: string | null;
  title: string;
  body: string;
  is_public: boolean;
  urgent: boolean;
  status: InfoRequestStatus;
  due_at: string;
  extended_to: string | null;
  extension_reason: string | null;
  response: string | null;
  response_url: string | null;
  refusal_reason: string | null;
  answered_at: string | null;
  created_at: string;
};

export type ConsultationKind = 'bill' | 'budget' | 'policy' | 'plan' | 'other';
export type Consultation = {
  id: string;
  slug: string;
  kind: ConsultationKind;
  title: string;
  title_sw: string | null;
  summary: string;
  summary_sw: string | null;
  document_url: string | null;
  questions: string[];
  ward_id: string | null;
  opens_at: string;
  closes_at: string;
  report: string | null;
  report_url: string | null;
  report_at: string | null;
};
export type Stance = 'support' | 'oppose' | 'amend' | 'comment';
export type ConsultationComment = { id: number; consultation_id: string; author_name: string | null; ward_id: string | null; question: number | null; stance: Stance; body: string; created_at: string };
export type ConsultationTally = { comments: number; people: number; wards: number; by_stance: Partial<Record<Stance, number>> };
export type ErasureRequest = { id: string; email: string | null; reason: string | null; created_at: string; due_at: string };

export type LegalDeadlines = {
  generated_at: string;
  info: { decided: number; on_time: number; waiting: number; late_now: number };
  petitions: { due: number; answered_on_time: number; answered_late: number; late_now: number };
  consultations: { closed: number; reported: number; report_owed: number };
  erasure: { done: number; on_time: number; late_now: number };
  promises: { total: number; delivered: number; past_due: number };
  concerns?: { answered: number; on_time: number; fixed: number; late_now: number };
};

export type FixedItem = { reference: string; category_id: string; category: string; category_sw: string | null; ward: string; ward_id: string; reported_at: string; resolved_at: string; before: string | null; after: string };

export type DisclosureTopic = 'bribery' | 'procurement' | 'payroll' | 'theft' | 'abuse_of_office' | 'other';
export type DisclosureThread = { reference: string; topic: DisclosureTopic; status: 'received' | 'reviewing' | 'referred' | 'closed'; referred_to: string | null; created_at: string; messages: { from_reporter: boolean; body: string; at: string }[] };

export type Champion = { ward_id: string; display_name: string; status: 'applied' | 'active' | 'paused' | 'declined'; approved_at: string | null; created_at: string; user_id?: string; motivation?: string | null };
export type ChampionCheck = { verdict: 'as_shown' | 'not_as_shown'; comment: string | null; at: string; champion: string };

export type ConcernKind = 'specs_tailored' | 'short_deadline' | 'single_bid' | 'price_inflated' | 'conflict_of_interest' | 'not_delivered' | 'other';
export type TenderConcern = { id: string; reference: string; tender_id: string; kind: ConcernKind; body: string; status: 'submitted' | 'answered' | 'fixed' | 'dismissed' | 'escalated'; response: string | null; escalated_to: string | null; due_at: string; answered_at: string | null; created_at: string };

export type CountyFinance = { county_code: number; fiscal_year: string; dev_budget: number | null; dev_spent: number | null; rec_budget: number | null; rec_spent: number | null; osr_target: number | null; osr_actual: number | null; pending_bills: number | null; audit_opinion: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer' | null; source: string; source_url: string | null; updated_at: string };

export type StatementResult = { id: number; body: string; created_at: string; agree: number; disagree: number; pass: number };
export type StatementResults = { statements: StatementResult[]; participants: number; votes: [number, number, -1 | 0 | 1][] };

export type PollOption = { id: string; label: string; label_sw?: string };
export type Poll = { id: string; slug: string; question: string; question_sw: string | null; options: PollOption[]; ward_id: string | null; opens_at: string; closes_at: string };
export type PollResults = { total: number; by_option: Record<string, number>; by_ward: { ward_id: string; option_id: string; n: number }[] };

export type FlagKind = 'consultation_comment' | 'statement' | 'champion_check' | 'concern' | 'mca_question';
export type FlagReason = 'abuse' | 'personal_details' | 'false' | 'spam' | 'other';
