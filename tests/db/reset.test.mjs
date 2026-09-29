// The one-off procedure for the existing County-Connect project: old schema -> reset-connect.sql -> setup.sql.
// Proves the reset leaves nothing behind, the bundle installs cleanly on top, and the result is locked down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSetupSql } from '../../scripts/build-setup-sql.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('the committed setup.sql is the current migrations, in order', () => {
  assert.equal(read('supabase/ops/setup.sql'), buildSetupSql(), 'run `npm run build:sql` and commit the result');
});

test('old CountyConnect schema -> reset -> setup: a clean, locked-down install', async () => {
  const db = new PGlite();
  await db.exec(read('tests/db/prelude.sql'));

  // What the old project looked like: its migrations (those that can run here) plus a user who signed up.
  const oldDir = resolve(root, 'legacy/connect/supabase/migrations');
  let applied = 0;
  for (const f of readdirSync(oldDir).filter((x) => x.endsWith('.sql')).sort()) {
    try { await db.exec(readFileSync(resolve(oldDir, f), 'utf8')); applied++; } catch { /* Supabase-only statements; the reset must cope with whatever is there */ }
  }
  await db.exec(`insert into auth.users (email, raw_user_meta_data) values ('daniel@example.com', '{"name":"Daniel"}')`);
  const oldTables = (await db.query(`select count(*)::int n from pg_tables where schemaname = 'public'`)).rows[0].n;
  assert.ok(applied >= 3 && oldTables > 5, `the old schema was present (${applied} migrations, ${oldTables} tables)`);

  await db.exec(read('supabase/ops/reset-connect.sql'));
  assert.equal((await db.query(`select count(*)::int n from pg_tables where schemaname = 'public'`)).rows[0].n, 0, 'nothing of the old schema is left');
  assert.equal((await db.query(`select count(*)::int n from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal`)).rows[0].n, 0, 'the old auth trigger went with it');
  assert.equal((await db.query(`select count(*)::int n from auth.users`)).rows[0].n, 1, 'accounts are kept');

  await db.exec(read('supabase/ops/setup.sql'));
  await db.exec(read('supabase/ops/after-setup.sql').replace(/select public\.grant_staff_role[\s\S]*?;\n/, ''));

  const q = async (sql, p) => (await db.query(sql, p)).rows[0];
  assert.equal((await q(`select count(*)::int n from public.wards`)).n, 85);
  assert.equal((await q(`select count(*)::int n from public.profiles where email = 'daniel@example.com'`)).n, 1, 'the existing account got its profile');
  assert.equal((await q(`select count(*)::int n from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal`)).n, 1, 'exactly one signup trigger');

  // locked down exactly as in a fresh install, and the service role still works
  const priv = (role, table, what) => q(`select has_table_privilege($1, $2, $3) as ok`, [role, table, what]).then((r) => r.ok);
  assert.equal(await priv('service_role', 'public.reports', 'insert'), true, 'the service role can write');
  assert.equal(await priv('anon', 'public.reports', 'select'), false);
  assert.equal(await priv('anon', 'public.reports', 'insert'), false);
  assert.equal(await priv('authenticated', 'public.staff_roles', 'insert'), false);
  assert.equal((await q(`select has_function_privilege('anon', 'public.svc_rate_limit(text,int,int)', 'execute') as ok`)).ok, false);
  assert.equal((await q(`select has_function_privilege('service_role', 'public.svc_rate_limit(text,int,int)', 'execute') as ok`)).ok, true);
  await db.exec(`set role service_role`);
  assert.equal((await q(`select public.svc_rate_limit('k', 60, 5) as ok`)).ok, true);
  await db.exec(`reset role`);
});
