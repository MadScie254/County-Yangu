# County Yangu + CountyConnect

One system for a county, with two doors:

- **County Yangu** (`/`): the residents' public window. Ward map and trust index, project tracker, budget votes, anonymous problem reports with a case number, SMS/USSD alerts, ideas and petitions, county tenders, and **My Services** (permits, licences, rates, with M-Pesa payment).
- **CountyConnect** (`/console`): the staff back office. Case inbox and SLA board, applications, publishing (projects, tenders, budget rounds, ward alerts), revenue, an AI assistant that only drafts and answers, oversight for the Assembly and auditors, and administration.

Both run on **one Supabase project per county**. Nairobi is the first deployment; another county is a new project, the same code and a different `VITE_COUNTY`.

## One sign-in, two spaces

Everyone has one account. Signing in lands on **My Yangu** (`/me`), the citizen dashboard: what needs you, your ward, your applications, the reports you sent from this device, and the county at a glance. People who hold a staff role also see a switch to the **staff console** (`/console`), and the console links straight back to the citizen view. A role is only ever a row in `staff_roles`; the switch grants nothing.

## Open County (transparency)

`/open` shows who wins county tenders, how contracts are awarded, and which patterns are flagged for a closer look (supplier concentration, single bidders, direct awards, awards above the estimate, projects over budget or stalled after spending). The rules live in the database (`procurement_watch()`, migration 0012), follow the open-contracting red-flag approach, and are listed on the page. A flag is a prompt, never a finding. Administrators review flags in the console (`/console/procurement`) and their response is published beside the flag. A daily job (`svc_procurement_scan`) remembers flags and emails administrators and auditors about new high-priority ones. Everything on the page can be downloaded as CSV.

## Stack

Vite + React 19, React Router 7, Tailwind 4, TanStack Query, Zustand, MapLibre GL with OpenStreetMap, Supabase (Postgres with row-level security, Auth, Storage, Edge Functions on Deno). Hosted as static files (Cloudflare Pages: `public/_redirects`, `public/_headers`).

## Run it

```bash
npm install
npm run dev                 # http://localhost:5173  (residents)   /console  (staff)
VITE_FORCE_DEMO=1 npm run dev   # no backend: labelled sample data
```
`.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_COUNTY=nairobi`. Nothing else.

## Set up a county's backend

1. New Supabase project. Install the schema: `supabase db push`, **or** paste `supabase/ops/setup.sql` into the SQL editor. (The project that still has the old CountyConnect schema: run `supabase/ops/reset-connect.sql` first; it is destructive and explains itself.)
2. `supabase/ops/after-setup.sql`: profiles for existing accounts, your first super administrator, the county's web addresses.
3. Functions and secrets: see `supabase/functions/README.md` (secrets template: `supabase/.env.example`). Schedule the jobs with `supabase/ops/schedule-jobs.sql`.
4. Real ward shapes: `node scripts/load-boundaries.mjs` (see the top of the file). Until then the map shows sub-county markers, never invented shapes.

## Tests

`npm test` (unit), `npm run test:db` (schema and security in an embedded Postgres), `npm run test:edge` (real function handlers under Deno), `npm run check:edge`. The security properties (no privilege escalation, anonymity separation, single-use codes, exactly-once payments, two-person alerts, immutable audit log) are tested in `tests/db`.

## Launch checklist

- [ ] Everyone on staff has enrolled an authenticator app; then switch on **Administration > Settings > two-factor** (the database refuses the switch from a password-only session).
- [ ] `COUNTY_HMAC_SECRET`, `CRON_SECRET`, callback tokens set; `ALLOWED_ORIGINS` and `CONSOLE_URL` set. Do not change `COUNTY_HMAC_SECRET` during a voting round.
- [ ] Old Edge Functions (`mpesa-stk-push`, `mpesa-webhook`, old `ussd-gateway`) deleted from the project.
- [ ] Daraja production credentials; C2B URLs registered; Africa's Talking callbacks pointed at `ussd-gateway` and `sms-inbound`.
- [ ] Public finance records have a serving copy in a Kenyan data centre (Data Protection regulation 26).
- [ ] Swahili copy reviewed by a native speaker; the county's fee schedule entered under Administration > Services.
- [ ] Any key that was ever committed or shared in chat is rotated (see Security notes).

## Security notes

The original CountyConnect commit history contained a Supabase service-role key and Daraja sandbox credentials. That history is **not** in this repository (the code was imported as a snapshot), but the keys were exposed elsewhere: rotate the Supabase keys and the Daraja credentials before real use.
