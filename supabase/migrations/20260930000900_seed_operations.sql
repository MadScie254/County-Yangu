-- 0009  Operational defaults for a new county: departments, report categories and their SLA timers,
--       default routing (category -> department, county-wide), and fixed-date public holidays.
-- All of it is editable by county admins in the console; these are sensible starting values, to be
-- confirmed with the county during discovery (departments, timers, movable holidays such as Eid).

insert into public.departments (code, name, name_sw) values
  ('roads',       'Roads, Transport & Public Works',        'Barabara, Uchukuzi na Kazi za Umma'),
  ('water',       'Water, Sanitation & Drainage',           'Maji, Usafi na Mifereji'),
  ('environment', 'Environment, Waste & Climate',           'Mazingira, Taka na Tabianchi'),
  ('health',      'Health Services',                        'Huduma za Afya'),
  ('education',   'Education & Vocational Training',        'Elimu na Mafunzo ya Ufundi'),
  ('planning',    'Urban Planning & Development Control',   'Mipango ya Miji na Udhibiti wa Ujenzi'),
  ('trade',       'Trade, Markets & Licensing',             'Biashara, Masoko na Leseni'),
  ('safety',      'Public Safety, Inspectorate & Disaster', 'Usalama wa Umma na Maafa'),
  ('finance',     'Finance & Revenue',                      'Fedha na Mapato'),
  ('integrity',   'Integrity, Ethics & Audit Desk',         'Dawati la Uadilifu na Ukaguzi')
on conflict (code) do nothing;

-- ack = time to acknowledge, resolve = time to fix. `sensitive` cases are routed to the integrity desk,
-- not to the department they complain about.
insert into public.report_categories
  (id, name, name_sw, department_id, ack_value, ack_unit, resolve_value, resolve_unit, default_priority, sensitive, sort)
select v.id, v.name, v.name_sw, d.id, v.ackv, v.acku, v.resv, v.resu, v.prio, v.sens, v.sort
from (values
  ('pothole',        'Pothole or damaged road',        'Shimo au barabara iliyoharibika', 'roads',       2,  'working_days', 21, 'working_days', 'normal', false, 10),
  ('streetlight',    'Streetlight not working',        'Taa ya barabarani haiwaki',       'roads',       2,  'working_days', 10, 'working_days', 'normal', false, 20),
  ('water_main',     'Burst water main',               'Bomba la maji limepasuka',        'water',       2,  'hours',        24, 'hours',        'urgent', false, 30),
  ('sewer',          'Blocked or overflowing sewer',   'Mfereji wa maji taka umeziba',    'water',       8,  'hours',        72, 'hours',        'high',   false, 40),
  ('drainage',       'Blocked drain or flooding',      'Mfereji umeziba au mafuriko',     'water',       1,  'working_days', 5,  'working_days', 'high',   false, 50),
  ('garbage',        'Uncollected garbage',            'Taka haijazolewa',                'environment', 1,  'working_days', 3,  'working_days', 'normal', false, 60),
  ('dumping',        'Illegal dumping',                'Utupaji taka haramu',             'environment', 2,  'working_days', 7,  'working_days', 'normal', false, 70),
  ('health_facility','Health facility problem',        'Tatizo la kituo cha afya',        'health',      2,  'working_days', 14, 'working_days', 'high',   false, 80),
  ('school',         'School infrastructure',          'Miundombinu ya shule',            'education',   3,  'working_days', 30, 'working_days', 'normal', false, 90),
  ('market',         'Market or trading space',        'Soko au eneo la biashara',        'trade',       2,  'working_days', 14, 'working_days', 'normal', false, 100),
  ('illegal_build',  'Illegal or unsafe construction', 'Ujenzi haramu au hatari',         'planning',    2,  'working_days', 14, 'working_days', 'high',   false, 110),
  ('safety_hazard',  'Public safety hazard',           'Hatari kwa usalama wa umma',      'safety',      2,  'hours',        48, 'hours',        'urgent', false, 120),
  ('abandoned',      'Abandoned or stalled project',   'Mradi ulioachwa au uliosimama',   'integrity',   2,  'working_days', 21, 'working_days', 'high',   true,  130),
  ('missing_funds',  'Suspected misuse of funds',      'Mashaka ya matumizi mabaya ya fedha', 'integrity', 2, 'working_days', 30, 'working_days', 'high', true,  140),
  ('other',          'Something else',                 'Jambo lingine',                   'environment', 2,  'working_days', 14, 'working_days', 'normal', false, 900)
) as v(id, name, name_sw, dept, ackv, acku, resv, resu, prio, sens, sort)
join public.departments d on d.code = v.dept
on conflict (id) do nothing;

-- Default county-wide routing: each category goes to its category's department (no named officer yet).
insert into public.routing_rules (category_id, ward_id, department_id)
select c.id, null, c.department_id from public.report_categories c
on conflict do nothing;

-- Fixed-date and computed public holidays (Kenya). Movable Islamic holidays (Idd-ul-Fitr) and
-- any holiday declared by the Cabinet Secretary are added by the county admin when gazetted.
insert into public.holidays (day, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-06', 'Easter Monday'),
  ('2026-05-01', 'Labour Day'),
  ('2026-06-01', 'Madaraka Day'),
  ('2026-10-10', 'Huduma Day'),
  ('2026-10-20', 'Mashujaa Day'),
  ('2026-12-12', 'Jamhuri Day'),
  ('2026-12-25', 'Christmas Day'),
  ('2026-12-26', 'Boxing Day'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-03-26', 'Good Friday'),
  ('2027-03-29', 'Easter Monday'),
  ('2027-05-01', 'Labour Day'),
  ('2027-06-01', 'Madaraka Day'),
  ('2027-10-20', 'Mashujaa Day'),
  ('2027-12-12', 'Jamhuri Day'),
  ('2027-12-25', 'Christmas Day')
on conflict (day) do nothing;
