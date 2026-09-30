-- 0018  Open reports a resident can join before filing a duplicate, and community checks on published projects.

-- ---- open reports of the same kind in a ward ------------------------------------------------------------------------
-- Shown while reporting so a resident can press "me too" instead of filing again. Reveals only what the public status
-- page already shows (reference, category, status, dates, how many people joined), never the description.
create function internal.open_cases(p_ward text, p_category text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x ->> 'supporters')::int desc, x ->> 'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object('reference', r.reference, 'category_id', r.category_id, 'status', r.status,
                              'created_at', r.created_at, 'supporters', r.supporters) as x
      from public.reports r
     where r.ward_id = p_ward
       and (p_category is null or r.category_id = p_category)
       and r.status not in ('resolved', 'closed', 'rejected')
       and r.duplicate_of is null
       and r.created_at > now() - interval '120 days'
     order by r.supporters desc, r.created_at desc
     limit 8
  ) t;
$$;
create function public.open_cases(p_ward text, p_category text default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.open_cases(p_ward => p_ward, p_category => p_category) $$;
revoke all on function public.open_cases(text, text) from public;
grant execute on function public.open_cases(text, text) to anon, authenticated, service_role;
grant execute on function internal.open_cases(text, text) to anon, authenticated, service_role;

-- ---- community checks on projects ---------------------------------------------------------------------------------
-- A resident who can see the site says whether it looks as the county describes it. One answer per person per
-- project (a keyed hash, like a vote), comments scrubbed of personal details before they arrive here.
create table private.project_checks (
  project_id  uuid not null references public.projects (id) on delete cascade,
  checker_hash bytea not null,
  verdict     text not null check (verdict in ('as_shown', 'not_as_shown')),
  comment     text check (char_length(comment) <= 400),
  created_at  timestamptz not null default now(),
  primary key (project_id, checker_hash)
);

-- Called only by the case-feedback Edge Function. 'ok' | 'duplicate' | 'not_found'.
create function public.svc_project_check(p_slug text, p_verdict text, p_comment text, p_checker bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.projects;
  v_no int;
begin
  if p_verdict not in ('as_shown', 'not_as_shown') then raise exception 'Invalid verdict' using errcode = '22023'; end if;
  select p.* into v_p from public.projects p where p.slug = p_slug and p.published;
  if not found then return 'not_found'; end if;
  begin
    insert into private.project_checks (project_id, checker_hash, verdict, comment)
    values (v_p.id, p_checker, p_verdict, nullif(left(trim(coalesce(p_comment, '')), 400), ''));
  exception when unique_violation then
    return 'duplicate';
  end;
  if p_verdict = 'not_as_shown' then
    select count(*) into v_no from private.project_checks c where c.project_id = v_p.id and c.verdict = 'not_as_shown';
    -- the third doubt, and every tenth after, is put in front of the people who publish projects
    if v_no = 3 or (v_no > 3 and v_no % 10 = 0) then
      insert into public.notifications (user_id, title, message, kind, link)
      select distinct r.user_id, 'Residents question a project',
             v_no || ' residents say "' || v_p.title || '" does not look as published. Check the site and update the project.',
             'warning', null
        from public.staff_roles r
       where r.active and (r.expires_at is null or r.expires_at > now())
         and (r.role in ('super_admin', 'admin', 'chief_officer') or (r.role in ('sub_county_admin', 'ward_admin') and (r.ward_id = v_p.ward_id or r.ward_id is null)));
    end if;
  end if;
  return 'ok';
end;
$$;
revoke all on function public.svc_project_check(text, text, text, bytea) from public, anon, authenticated;

-- What residents say about a project: totals and the latest comments.
create function internal.project_checks(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'as_shown', count(*) filter (where c.verdict = 'as_shown'),
    'not_as_shown', count(*) filter (where c.verdict = 'not_as_shown'),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('verdict', c2.verdict, 'comment', c2.comment, 'at', c2.created_at) order by c2.created_at desc)
        from (select * from private.project_checks c3 where c3.project_id = p.id and c3.comment is not null order by c3.created_at desc limit 6) c2
    ), '[]'::jsonb))
  from public.projects p
  left join private.project_checks c on c.project_id = p.id
  where p.slug = p_slug and p.published
  group by p.id;
$$;
create function public.project_checks(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select internal.project_checks(p_slug => p_slug) $$;
revoke all on function public.project_checks(text) from public;
grant execute on function public.project_checks(text) to anon, authenticated, service_role;
grant execute on function internal.project_checks(text) to anon, authenticated, service_role;
