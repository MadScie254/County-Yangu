-- 0004  My Services: catalogue, applications, payments, revenue, notifications.
-- (Ported from CountyConnect's citizen screens, with real keys instead of free text.)

create table public.services (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  name_sw       text,
  department_id uuid references public.departments (id),
  category      text not null default 'permit' check (category in ('permit', 'licence', 'rates', 'welfare', 'planning', 'health', 'other')),
  description   text,
  fee           numeric(14, 2) not null default 0 check (fee >= 0),
  fee_note      text,
  requires_kra_pin boolean not null default false,       -- checked through GavaConnect before submission
  form_schema   jsonb not null default '[]'::jsonb,      -- ordered field definitions rendered by the app
  required_documents text[] not null default '{}',
  sla_working_days int not null default 14,
  status        text not null default 'draft' check (status in ('draft', 'active', 'suspended')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.applications (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique default private.new_reference('A'),
  service_id    uuid not null references public.services (id),
  applicant_id  uuid not null references auth.users (id),
  ward_id       text references public.wards (id),
  business_name text,
  kra_pin       text,
  form_data     jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in (
                  'draft', 'awaiting_payment', 'submitted', 'under_review',
                  'changes_requested', 'approved', 'rejected', 'withdrawn')),
  amount        numeric(14, 2) not null default 0 check (amount >= 0),   -- copied from the service fee by the server, never trusted from the client
  assigned_to   uuid references auth.users (id),
  decided_by    uuid references auth.users (id),
  decided_at    timestamptz,
  decision_note text,
  due_at        timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index applications_applicant_idx on public.applications (applicant_id);
create index applications_status_idx    on public.applications (status);
create index applications_service_idx   on public.applications (service_id);

create table public.application_documents (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  kind           text not null,
  storage_path   text not null,
  created_at     timestamptz not null default now()
);
create index application_documents_app_idx on public.application_documents (application_id);

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  checkout_request_id text unique,
  application_id      uuid references public.applications (id),
  payer_id            uuid references auth.users (id),
  phone_last4         text,                               -- the full MSISDN is not kept here
  amount              numeric(14, 2) not null check (amount > 0),
  status              text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'timeout')),
  mpesa_receipt       text unique,
  stream              text not null default 'services',   -- revenue stream: services, land_rates, market_fees ...
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index payments_application_idx on public.payments (application_id);

create table public.revenue_entries (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,                      -- M-Pesa receipt or bank reference
  amount      numeric(14, 2) not null check (amount > 0),
  payer_name  text,
  stream      text not null,
  source      text not null default 'mpesa' check (source in ('mpesa', 'cash', 'bank')),
  payment_id  uuid references public.payments (id),
  reconciled  boolean not null default false,
  received_at timestamptz not null default now()
);
create index revenue_entries_received_idx on public.revenue_entries (received_at);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  message    text not null,
  kind       text not null default 'info' check (kind in ('info', 'success', 'warning', 'error')),
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- The server, not the browser, decides what an application costs.
create function private.application_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee numeric;
  v_sla int;
begin
  if tg_op = 'INSERT' then
    select s.fee, s.sla_working_days into v_fee, v_sla from public.services s where s.id = new.service_id and s.status = 'active';
    if not found then
      raise exception 'Service is not available' using errcode = '22023';
    end if;
    new.amount := v_fee;
    new.due_at := private.add_working_days(now(), v_sla);
    new.status := 'draft';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger applications_defaults
  before insert or update on public.applications
  for each row execute function private.application_defaults();

-- Applicants can never change price, owner, assignment or decision fields.
create function private.applications_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_staff() then
    if new.amount is distinct from old.amount
       or new.applicant_id is distinct from old.applicant_id
       or new.service_id is distinct from old.service_id
       or new.assigned_to is distinct from old.assigned_to
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.decision_note is distinct from old.decision_note then
      raise exception 'Protected application fields cannot be changed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('draft', 'changes_requested') and new.status in ('draft', 'awaiting_payment', 'submitted', 'withdrawn')) then
      raise exception 'Invalid status change' using errcode = '42501';
    end if;
    -- a fee-bearing application cannot skip payment
    if new.status = 'submitted' and old.status <> 'submitted' and new.amount > 0
       and not exists (select 1 from public.payments p where p.application_id = new.id and p.status = 'completed') then
      raise exception 'Payment required before submission' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger applications_guard_update
  before update on public.applications
  for each row execute function private.applications_guard();

-- Staff decision on an application (the only way status moves to approved/rejected).
create function public.decide_application(p_application uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_dept uuid;
begin
  if p_decision not in ('approved', 'rejected', 'changes_requested', 'under_review') then
    raise exception 'Invalid decision %', p_decision using errcode = '22023';
  end if;
  select a.* into v_app from public.applications a where a.id = p_application;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  select s.department_id into v_dept from public.services s where s.id = v_app.service_id;

  if not (private.is_admin()
          or exists (select 1 from public.staff_roles r
                     where r.user_id = (select auth.uid()) and r.active
                       and (r.expires_at is null or r.expires_at > now())
                       and r.role in ('chief_officer', 'officer') and r.department_id = v_dept)) then
    raise exception 'Not allowed to decide this application' using errcode = '42501';
  end if;
  if v_app.status not in ('submitted', 'under_review', 'changes_requested') then
    raise exception 'Application is not awaiting a decision (status %)', v_app.status using errcode = '22023';
  end if;

  update public.applications
     set status = p_decision,
         decided_by = case when p_decision in ('approved', 'rejected') then (select auth.uid()) else decided_by end,
         decided_at = case when p_decision in ('approved', 'rejected') then now() else decided_at end,
         decision_note = coalesce(p_note, decision_note)
   where id = p_application;

  insert into public.notifications (user_id, title, message, kind, link)
  values (v_app.applicant_id,
          'Application ' || v_app.reference,
          case p_decision
            when 'approved' then 'Your application was approved.'
            when 'rejected' then 'Your application was not approved.' || coalesce(' ' || p_note, '')
            when 'changes_requested' then 'Changes are needed: ' || coalesce(p_note, 'see the application')
            else 'Your application is under review.'
          end,
          case p_decision when 'approved' then 'success' when 'rejected' then 'error' else 'info' end,
          '/services/applications/' || v_app.id);
end;
$$;
grant execute on function public.decide_application(uuid, text, text) to authenticated;
