-- County Yangu reference schema. Use a separate Supabase project from CountyConnect.
create type public.channel_origin as enum ('web', 'ussd', 'ivr');
create type public.project_status as enum ('planned', 'procurement', 'in_progress', 'stalled', 'completed');
create type public.report_status as enum ('received', 'under_review', 'routed', 'resolved');

create table public.wards (
  id text primary key,
  name text not null,
  sub_county text not null,
  constituency text not null,
  geometry jsonb not null
);

create table public.budget_cycles (
  id text primary key,
  title text not null,
  status text not null check (status in ('draft', 'open', 'closed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null
);

create table public.ward_budget_envelopes (
  id uuid primary key default gen_random_uuid(),
  cycle_id text references public.budget_cycles(id) on delete cascade,
  ward_id text references public.wards(id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null default 'KES',
  unique (cycle_id, ward_id)
);

create table public.project_options (
  id text primary key,
  cycle_id text references public.budget_cycles(id) on delete cascade,
  ward_id text references public.wards(id) on delete cascade,
  title text not null,
  sector text not null,
  amount numeric(14, 2) not null
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  cycle_id text references public.budget_cycles(id) on delete cascade,
  ward_id text references public.wards(id) on delete cascade,
  project_option_id text references public.project_options(id) on delete cascade,
  channel channel_origin not null,
  phone_hash bytea not null,
  created_at timestamptz not null default now(),
  unique (cycle_id, phone_hash)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  ward_id text references public.wards(id) on delete cascade,
  title text not null,
  sector text not null,
  budget numeric(14, 2) not null,
  spent numeric(14, 2) not null default 0,
  contractor text not null,
  status project_status not null,
  location jsonb not null,
  milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  case_reference text unique not null,
  ward_id text references public.wards(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  category text not null,
  description text not null,
  status report_status not null default 'received',
  channel channel_origin not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  ward_id text references public.wards(id) on delete cascade,
  phone_hash bytea not null,
  channel_preference text not null check (channel_preference in ('sms', 'ussd', 'whatsapp')),
  created_at timestamptz not null default now()
);

create table public.channel_sessions (
  id uuid primary key default gen_random_uuid(),
  ward_id text references public.wards(id) on delete set null,
  channel channel_origin not null,
  action text not null check (action in ('vote', 'report', 'track', 'subscribe')),
  created_at timestamptz not null default now()
);

create view public.public_vote_tally as
select
  cycle_id,
  ward_id,
  project_option_id,
  channel,
  count(*)::int as vote_count
from public.votes
group by cycle_id, ward_id, project_option_id, channel;

create view public.public_report_aggregates as
select
  ward_id,
  category,
  status,
  channel,
  date_trunc('day', created_at) as day,
  count(*)::int as report_count
from public.reports
group by ward_id, category, status, channel, date_trunc('day', created_at);

alter table public.wards enable row level security;
alter table public.budget_cycles enable row level security;
alter table public.ward_budget_envelopes enable row level security;
alter table public.project_options enable row level security;
alter table public.votes enable row level security;
alter table public.projects enable row level security;
alter table public.reports enable row level security;
alter table public.alert_subscriptions enable row level security;
alter table public.channel_sessions enable row level security;

create policy "public can read wards" on public.wards for select using (true);
create policy "public can read cycles" on public.budget_cycles for select using (true);
create policy "public can read envelopes" on public.ward_budget_envelopes for select using (true);
create policy "public can read options" on public.project_options for select using (true);
create policy "public can read projects" on public.projects for select using (true);

create policy "citizens can insert votes only" on public.votes
for insert with check (channel in ('web', 'ussd', 'ivr'));

create policy "citizens can create anonymous reports only" on public.reports
for insert with check (channel in ('web', 'ussd', 'ivr'));

create policy "citizens can subscribe by hashed phone only" on public.alert_subscriptions
for insert with check (octet_length(phone_hash) >= 32);

create policy "public can insert anonymous channel sessions" on public.channel_sessions
for insert with check (channel in ('web', 'ussd', 'ivr'));

-- Raw vote hashes, alert hashes, and report descriptions must never be selected by anon clients.
-- Use service-role Edge Functions for phone hashing, SMS confirmation, and immediate PII deletion.
