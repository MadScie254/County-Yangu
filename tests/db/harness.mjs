// Test harness: an in-memory Postgres (PGlite) with the Supabase prelude and every migration applied.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../supabase/migrations');

export async function freshDb() {
  const db = new PGlite();
  await db.exec(readFileSync(resolve(here, 'prelude.sql'), 'utf8'));
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(resolve(migrationsDir, f), 'utf8'));
    } catch (e) {
      e.message = `${f}: ${e.message}`;
      throw e;
    }
  }
  return db;
}

// Run `fn` as a database role, optionally impersonating a signed-in user (auth.uid()).
export async function as(db, role, userId, fn) {
  await db.exec(`set role ${role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [userId ?? '', role]);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`);
  }
}

export async function newUser(db, email, meta = {}) {
  const { rows } = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}
