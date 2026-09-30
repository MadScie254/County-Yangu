# Working in this repository

County Yangu (residents) and CountyConnect (county staff) are one system: two doors, one database, one Supabase project per county.

- `src/resident` is the public app (served at `/`); `src/console` is the staff app (served at `/console`). They are separate bundles built from one Vite project. `src/shared` is used by both.
- The database is the source of truth for every rule: `supabase/migrations`. Public writes go through `supabase/functions` (Deno), which call `svc_*` database functions. Read `supabase/functions/README.md` before changing either.
- Never put a secret in a `VITE_` variable: those ship to every browser. Secrets live in `supabase/.env` (gitignored) and Supabase function secrets.
- A role is only ever a row in `staff_roles`. Never derive permissions from user metadata, the URL, or a form choice.
- One account, two spaces: `/me` is the citizen dashboard, `/console` the staff console. Anyone signed in reaches `/me`; the staff switch only appears for people with a `staff_roles` row.
- Transparency rules (who wins tenders, red flags) live in the database (`procurement_watch`, migration 0012). `src/shared/lib/procurement.ts` is its demo-mode twin: change both together, and keep `tests/unit/procurement.test.ts` and `tests/db/procurement.test.mjs` in step.
- No em dashes or en dashes anywhere, in copy or code.
- Live-first data with a labelled demo fallback: screens must work with no backend (`VITE_FORCE_DEMO=1`).

Checks before you commit: `npx tsc --noEmit`, `npx eslint src`, `npm test`, `npm run test:db`, and (needs Deno) `npm run test:edge` and `npm run check:edge`.
