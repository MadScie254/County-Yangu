-- 0021  Open311 GeoReport v2 (read side) and a public scoreboard of the county's legal deadlines.
--   * Open311 is the open standard FixMyStreet, SeeClickFix and many cities use, so other systems, researchers and
--     reporters can read the county's issue reports without scraping. It exposes only what the public status page
--     already shows: no descriptions, no photos, no reporter, locations rounded to about 100 metres, and nothing from
--     sensitive categories (integrity and finance reports, where whistleblowers must stay hidden).
--   * legal_deadlines(): did the county answer information requests, petitions, consultations and erasure requests
--     within the time the law (or this county's own rule) gives it?

-- ---- Open311 ------------------------------------------------------------------------------------------------------
create function internal.open311_services()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'service_code', c.id,
    'service_name', c.name,
    'description', coalesce(c.name_sw, c.name),
    'metadata', false,
    'type', 'realtime',
    'keywords', '',
    'group', coalesce(d.name, 'County services')) order by c.name), '[]'::jsonb)
  from public.report_categories c
  left join public.departments d on d.id = c.department_id
  where not c.sensitive;
$$;
create function public.open311_services()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.open311_services() $$;
revoke all on function public.open311_services() from public;
grant execute on function public.open311_services() to anon, authenticated, service_role;
grant execute on function internal.open311_services() to anon, authenticated, service_role;

-- GeoReport v2 defaults: the last 90 days, at most 1,000 requests, newest first.
create function internal.open311_requests(
  p_service_code text default null, p_status text default null,
  p_start timestamptz default null, p_end timestamptz default null, p_ids text[] default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'requested_datetime' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'service_request_id', r.reference,
      'status', case when r.status in ('resolved', 'closed', 'rejected') then 'closed' else 'open' end,
      'status_notes', (select e.message from public.report_events e where e.report_id = r.id and e.is_public order by e.created_at desc limit 1),
      'service_name', c.name,
      'service_code', r.category_id,
      'description', null,
      'agency_responsible', d.name,
      'service_notice', null,
      'requested_datetime', r.created_at,
      'updated_datetime', r.updated_at,
      'expected_datetime', r.resolve_due_at,
      'address', w.name || ' ward',
      'address_id', r.ward_id,
      'zipcode', null,
      'lat', round(r.lat, 3),
      'long', round(r.lng, 3),
      'media_url', null) as x
      from public.reports r
      join public.wards w on w.id = r.ward_id
      left join public.report_categories c on c.id = r.category_id
      left join public.departments d on d.id = r.department_id
     where r.duplicate_of is null
       and not coalesce(c.sensitive, false)              -- integrity and finance reports never appear in a bulk feed
       and (p_ids is null or r.reference = any (select upper(trim(i)) from unnest(p_ids) i))
       and (p_ids is not null or r.created_at >= coalesce(p_start, now() - interval '90 days'))
       and (p_ids is not null or r.created_at <= coalesce(p_end, now()))
       and (p_service_code is null or r.category_id = any (string_to_array(p_service_code, ',')))
       and (p_status is null or (p_status = 'open') = (r.status not in ('resolved', 'closed', 'rejected')))
     order by r.created_at desc
     limit 1000
  ) t;
$$;
create function public.open311_requests(
  p_service_code text default null, p_status text default null,
  p_start timestamptz default null, p_end timestamptz default null, p_ids text[] default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.open311_requests(p_service_code => p_service_code, p_status => p_status, p_start => p_start, p_end => p_end, p_ids => p_ids) $$;
revoke all on function public.open311_requests(text, text, timestamptz, timestamptz, text[]) from public;
grant execute on function public.open311_requests(text, text, timestamptz, timestamptz, text[]) to anon, authenticated, service_role;
grant execute on function internal.open311_requests(text, text, timestamptz, timestamptz, text[]) to anon, authenticated, service_role;

-- ---- petitions: when was the answer given ---------------------------------------------------------------------------
alter table public.proposals add column responded_at timestamptz;
create function private.proposals_responded()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.response is not null and (tg_op = 'INSERT' or old.response is null) then new.responded_at := now(); end if;
  return new;
end;
$$;
create trigger proposals_responded before insert or update of response on public.proposals
  for each row execute function private.proposals_responded();
update public.proposals set responded_at = created_at where response is not null and responded_at is null;

-- ---- the scoreboard -----------------------------------------------------------------------------------------------
create function internal.legal_deadlines()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'info', (select jsonb_build_object(
        'decided', count(*) filter (where i.answered_at is not null),
        'on_time', count(*) filter (where i.answered_at is not null and i.answered_at <= coalesce(i.extended_to, i.due_at)),
        'waiting', count(*) filter (where i.status in ('submitted', 'extended')),
        'late_now', count(*) filter (where i.status in ('submitted', 'extended') and coalesce(i.extended_to, i.due_at) < now()))
      from public.info_requests i),
    'petitions', (select jsonb_build_object(
        'due', count(*) filter (where p.response_due_at is not null),
        'answered_on_time', count(*) filter (where p.responded_at is not null and p.responded_at <= p.response_due_at),
        'answered_late', count(*) filter (where p.responded_at > p.response_due_at),
        'late_now', count(*) filter (where p.responded_at is null and p.response_due_at < now()))
      from public.proposals p where p.kind = 'petition'),
    'consultations', (select jsonb_build_object(
        'closed', count(*) filter (where c.closes_at < now()),
        'reported', count(*) filter (where c.closes_at < now() and c.report_at is not null),
        'report_owed', count(*) filter (where c.closes_at < now() - interval '30 days' and c.report_at is null))
      from public.consultations c),
    'erasure', (select jsonb_build_object(
        'done', count(*) filter (where e.done_at is not null),
        'on_time', count(*) filter (where e.done_at is not null and e.done_at <= e.due_at),
        'late_now', count(*) filter (where e.done_at is null and e.due_at < now()))
      from private.erasure_requests e),
    'promises', (select jsonb_build_object(
        'total', count(*),
        'delivered', count(*) filter (where m.status = 'delivered'),
        'past_due', count(*) filter (where m.due_on < current_date and m.status not in ('delivered', 'dropped')))
      from public.commitments m)
  );
$$;
create function public.legal_deadlines()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.legal_deadlines() $$;
revoke all on function public.legal_deadlines() from public;
grant execute on function public.legal_deadlines() to anon, authenticated, service_role;
grant execute on function internal.legal_deadlines() to anon, authenticated, service_role;
