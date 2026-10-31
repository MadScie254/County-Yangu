-- Migration 0024: stalled projects per county, as the counties report them to the Controller of Budget
-- (County Governments Budget Implementation Review Report, the stalled projects table). Empty means no figure was
-- reported, which is not the same as none. The amount paid can exceed the value: the report itself flags that.
alter table public.county_finance
  add column stalled_count int check (stalled_count >= 0),
  add column stalled_value numeric(16, 2) check (stalled_value >= 0),
  add column stalled_paid  numeric(16, 2) check (stalled_paid >= 0);

comment on column public.county_finance.stalled_count is 'Number of stalled projects the county reported at the end of the year; null if not reported.';
comment on column public.county_finance.stalled_value is 'Estimated value of those stalled projects, in shillings.';
comment on column public.county_finance.stalled_paid is 'Amount already paid on those stalled projects, in shillings.';
