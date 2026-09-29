-- 0003  Civic data: cases (reports), projects, participatory budget, tenders, proposals, alerts.
--
-- Anonymity rules:
--  * reports carry NO reporter identity. An optional callback number lives in
--    private.report_contacts, keyed by report id, and is never joined to votes.
--  * votes carry only a keyed hash of the phone number (HMAC with a county secret,
--    computed in the Edge Function). Votes and reports never share a key.

-- ---- contractors, projects ---------------------------------------------------

create table public.contractors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  registration_no text,
  kra_pin       text,
  kra_compliant boolean,                    -- last GavaConnect check result
  kra_checked_at timestamptz,
  flags         text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table public.tenders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  title                 text not null,
  ward_id               text references public.wards (id),
  sector                text not null,
  status                text not null default 'open' check (status in ('draft', 'open', 'evaluating', 'awarded', 'cancelled')),
  estimated_budget      numeric(16, 2) not null check (estimated_budget >= 0),
  applicants_count      int not null default 0,
  awarded_contractor_id uuid references public.contractors (id),
  published_at          timestamptz,
  closes_at             timestamptz,
  created_by            uuid references auth.users (id),
  created_at            timestamptz not null default now()
);

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  ward_id       text not null references public.wards (id),
  title         text not null,
  sector        text not null,
  description   text,
  status        text not null default 'planned' check (status in ('planned', 'procurement', 'in_progress', 'stalled', 'completed')),
  budget        numeric(16, 2) not null check (budget >= 0),
  spent         numeric(16, 2) not null default 0 check (spent >= 0),
  contractor_id uuid references public.contractors (id),
  tender_id     uuid references public.tenders (id),
  lat           numeric(9, 6),
  lng           numeric(9, 6),
  started_at    date,
  expected_at   date,
  completed_at  date,
  published     boolean not null default false,
  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index projects_ward_idx on public.projects (ward_id);
create index projects_status_idx on public.projects (status);

create table public.project_milestones (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null,
  due_date     date,
  completed_at date,
  sort         int not null default 0
);
create index project_milestones_project_idx on public.project_milestones (project_id);

create table public.project_photos (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  caption      text,
  taken_at     timestamptz,
  created_at   timestamptz not null default now()
);
create index project_photos_project_idx on public.project_photos (project_id);

-- ---- participatory budget ----------------------------------------------------

create table public.budget_cycles (
  id        text primary key,
  title     text not null,
  status    text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  published_results boolean not null default false,
  check (ends_at > starts_at)
);

create table public.ward_budget_envelopes (
  cycle_id text not null references public.budget_cycles (id) on delete cascade,
  ward_id  text not null references public.wards (id) on delete cascade,
  amount   numeric(16, 2) not null check (amount >= 0),
  primary key (cycle_id, ward_id)
);

create table public.project_options (
  id        text primary key,
  cycle_id  text not null references public.budget_cycles (id) on delete cascade,
  ward_id   text not null references public.wards (id) on delete cascade,
  title     text not null,
  sector    text not null,
  description text,
  amount    numeric(16, 2) not null check (amount >= 0)
);
create index project_options_cycle_ward_idx on public.project_options (cycle_id, ward_id);

-- One vote per verified phone per cycle. voter_hash = HMAC(county secret, cycle || msisdn).
create table public.votes (
  id         uuid primary key default gen_random_uuid(),
  cycle_id   text not null references public.budget_cycles (id) on delete cascade,
  ward_id    text not null references public.wards (id),
  option_id  text not null references public.project_options (id),
  channel    text not null check (channel in ('web', 'ussd', 'ivr', 'sms')),
  voter_hash bytea not null,
  created_at timestamptz not null default now(),
  unique (cycle_id, voter_hash)
);

-- ---- cases (citizen reports) -------------------------------------------------

-- Case references are unguessable enough to act as a bearer token for the public
-- status page: 3-letter county prefix + 10 hex chars (40 bits) from a CSPRNG.
create function private.new_reference(p_kind text default 'R')
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(coalesce(substr((select c.slug from public.county c limit 1), 1, 3), 'CTY'))
         || '-' || p_kind || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique default private.new_reference('R'),
  client_key       uuid unique,                         -- idempotency key from the offline queue
  ward_id          text not null references public.wards (id),
  category_id      text references public.report_categories (id),
  department_id    uuid references public.departments (id),
  description      text not null check (char_length(description) between 5 and 2000),  -- personal details already scrubbed
  status           text not null default 'received' check (status in ('received', 'triaged', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected')),
  priority         text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  channel          text not null default 'web' check (channel in ('web', 'ussd', 'sms', 'ivr', 'voice')),
  language         text,
  lat              numeric(9, 6),
  lng              numeric(9, 6),
  assigned_to      uuid references auth.users (id),
  project_id       uuid references public.projects (id),
  duplicate_of     uuid references public.reports (id),
  flagged_financial boolean not null default false,     -- set by rules/AI; reviewable by staff
  ack_due_at       timestamptz,
  resolve_due_at   timestamptz,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz,
  escalation_level smallint not null default 0,         -- 0 none, 1 reminder, 2 sub-county, 3 chief officer, 4 CEC/assembly, 5 oversight digest
  last_escalated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index reports_ward_idx        on public.reports (ward_id);
create index reports_status_idx      on public.reports (status) where status not in ('resolved', 'closed', 'rejected');
create index reports_assignee_idx    on public.reports (assigned_to);
create index reports_dept_idx        on public.reports (department_id);
create index reports_resolve_due_idx on public.reports (resolve_due_at) where status not in ('resolved', 'closed', 'rejected');

create table public.report_photos (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index report_photos_report_idx on public.report_photos (report_id);

-- Timeline. `public` rows (with a public message) are visible on the case-status page.
create table public.report_events (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports (id) on delete cascade,
  kind       text not null check (kind in ('created', 'triaged', 'assigned', 'status', 'note', 'public_message', 'reminder', 'escalated', 'merged')),
  actor_id   uuid references auth.users (id),           -- null = system
  is_public  boolean not null default false,
  message    text,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index report_events_report_idx on public.report_events (report_id, created_at);

-- Routing matrix (admin-editable): category x ward -> department / officer.
-- The most specific matching row wins (ward-specific before county-wide).
create table public.routing_rules (
  id            uuid primary key default gen_random_uuid(),
  category_id   text not null references public.report_categories (id) on delete cascade,
  ward_id       text references public.wards (id) on delete cascade,   -- null = whole county
  department_id uuid not null references public.departments (id),
  officer_id    uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  unique nulls not distinct (category_id, ward_id)
);

-- ---- proposals / petitions ---------------------------------------------------

create table public.proposals (
  id          uuid primary key default gen_random_uuid(),
  ward_id     text references public.wards (id),        -- null = county-wide
  kind        text not null default 'proposal' check (kind in ('proposal', 'petition')),
  title       text not null check (char_length(title) between 5 and 160),
  body        text not null check (char_length(body) between 10 and 4000),
  status      text not null default 'submitted' check (status in ('submitted', 'under_review', 'accepted', 'declined', 'merged')),
  response    text,
  responded_by uuid references auth.users (id),
  cluster_id  uuid references public.proposals (id),
  supporters  int not null default 0,
  created_at  timestamptz not null default now()
);

create table public.proposal_supports (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  voter_hash  bytea not null,
  created_at  timestamptz not null default now(),
  primary key (proposal_id, voter_hash)
);

-- Keep the supporter count exact and cheap to read.
create function private.bump_supporters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.proposals set supporters = supporters + 1 where id = new.proposal_id;
  return new;
end;
$$;
create trigger proposal_supports_count
  after insert on public.proposal_supports
  for each row execute function private.bump_supporters();

-- ---- ward alerts (staff compose -> a second person approves -> send) ---------

create table public.alerts (
  id          uuid primary key default gen_random_uuid(),
  ward_id     text references public.wards (id),        -- null = county-wide
  title       text not null,
  body        text not null check (char_length(body) <= 480),
  status      text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'sent', 'cancelled')),
  created_by  uuid not null references auth.users (id),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  sent_at     timestamptz,
  recipients  int,
  created_at  timestamptz not null default now(),
  check (approved_by is null or approved_by <> created_by)   -- four eyes
);

-- ---- private tables (never exposed through the API) --------------------------

-- Optional, opt-in callback number for a report. Consent is explicit and recorded.
create table private.report_contacts (
  report_id  uuid primary key references public.reports (id) on delete cascade,
  phone_e164 text not null,
  consented_at timestamptz not null default now()
);

-- SMS alert subscribers (the number itself is needed to send).
create table private.subscribers (
  id          uuid primary key default gen_random_uuid(),
  phone_e164  text not null,
  ward_id     text not null references public.wards (id),
  channel     text not null default 'sms' check (channel in ('sms', 'whatsapp', 'push')),
  frequency   text not null default 'weekly' check (frequency in ('instant', 'daily', 'weekly')),
  verified_at timestamptz,
  opted_out_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (phone_e164, ward_id)
);

-- One-time codes for phone verification. Only a hash of the code is stored.
create table private.otp_codes (
  id         uuid primary key default gen_random_uuid(),
  phone_hash bytea not null,
  phone_e164 text not null,
  code_hash  bytea not null,
  purpose    text not null check (purpose in ('vote', 'alerts', 'petition', 'login')),
  attempts   int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_codes_phone_idx on private.otp_codes (phone_hash, created_at desc);

-- Sliding-window counters for abuse control (SMS pumping, spam).
create table private.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (key, window_start)
);

-- Outgoing messages. The send function drains this table.
create table private.outbox (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null check (channel in ('sms', 'email', 'push')),
  recipient  text not null,
  subject    text,
  body       text not null,
  status     text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts   int not null default 0,
  last_error text,
  run_after  timestamptz not null default now(),
  related    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index outbox_due_idx on private.outbox (run_after) where status = 'queued';

-- Fixed-window rate limiter used by the Edge Functions (service role).
create function private.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into private.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = private.rate_limits.hits + 1
  returning hits into v_hits;
  -- opportunistic cleanup
  delete from private.rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_max;
end;
$$;
revoke execute on function private.rate_limit_hit(text, int, int) from authenticated;
grant execute on function private.rate_limit_hit(text, int, int) to service_role;

grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;
