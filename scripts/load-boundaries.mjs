#!/usr/bin/env node
// Ward boundaries for one county: fetch or read them, match them to the county's wards, and publish.
//
//   node scripts/load-boundaries.mjs fetch  nairobi [--level 7] [--out tmp/nairobi-raw.geojson]
//        Downloads administrative boundaries for the county from OpenStreetMap (Overpass). Run it on your own machine:
//        it needs internet access to overpass-api.de. With no --level it lists which admin levels exist so you can choose.
//   node scripts/load-boundaries.mjs build  nairobi --in tmp/nairobi-raw.geojson [--name-prop name] [--code-prop CODE] [--allow-partial]
//        Works on ANY GeoJSON of ward polygons (OSM export above, an IEBC/county GIS file, a Kenya Open Data download).
//        Matches them to the 85 wards, simplifies, writes public/geo/nairobi-wards.geojson and reports what did not match.
//   node scripts/load-boundaries.mjs push   nairobi
//        Saves the boundaries into the database (wards.geojson, bbox, centroid) so report intake can place a pin in its ward.
//        Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never commit them).
//
// Boundaries are only ever loaded from data you supply; the map and intake do not invent shapes.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOutputs, matchWards } from './lib/boundaries.mjs';

const [cmd, slug = 'nairobi', ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const has = (name) => rest.includes(`--${name}`);
const ref = JSON.parse(readFileSync(resolve(`src/shared/data/reference.${slug}.json`), 'utf8'));
const publicPath = resolve(`public/geo/${slug}-wards.geojson`);
const rowsPath = resolve(`tmp/${slug}-ward-rows.json`);

async function fetchOsm() {
  const level = flag('level');
  const out = resolve(flag('out') ?? `tmp/${slug}-raw.geojson`);
  const name = `${ref.county.name} County`;
  const query = (lvl) => `[out:json][timeout:240];area["name"="${name}"]["boundary"="administrative"]["admin_level"="4"]->.c;relation(area.c)["boundary"="administrative"]${lvl ? `["admin_level"="${lvl}"]` : ''};out tags;`;
  const call = async (q) => {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) });
    if (!res.ok) throw new Error(`Overpass answered ${res.status}. Try again in a minute, or download the boundaries another way and use "build --in".`);
    return res.json();
  };
  if (!level) {
    const r = await call(query());
    const byLevel = {};
    for (const e of r.elements) (byLevel[e.tags.admin_level] ??= []).push(e.tags.name ?? '(unnamed)');
    console.log(`Administrative areas inside ${name}, by OSM admin_level:`);
    for (const [l, names] of Object.entries(byLevel).sort()) console.log(`  level ${l}: ${names.length} areas, e.g. ${names.slice(0, 4).join(', ')}`);
    console.log(`\nWards are the level with about ${ref.wards.length} areas. Then run again with --level <n>.`);
    return;
  }
  const { default: osmtogeojson } = await import('osmtogeojson').catch(() => { throw new Error('Install the converter first:  npm i -D osmtogeojson'); });
  const data = await call(`[out:json][timeout:300];area["name"="${name}"]["boundary"="administrative"]["admin_level"="4"]->.c;relation(area.c)["boundary"="administrative"]["admin_level"="${level}"];(._;>;);out body;`);
  const fc = osmtogeojson(data);
  fc.features = fc.features.filter((f) => f.geometry && /Polygon/.test(f.geometry.type));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(fc));
  console.log(`Wrote ${fc.features.length} polygons to ${out}. Next:  node scripts/load-boundaries.mjs build ${slug} --in ${out}`);
}

function build() {
  const input = flag('in');
  if (!input || !existsSync(input)) throw new Error('Give the GeoJSON file with --in <file>');
  const fc = JSON.parse(readFileSync(input, 'utf8'));
  const features = fc.type === 'FeatureCollection' ? fc.features : [fc];
  const m = matchWards(features, ref.wards, { nameProp: flag('name-prop'), codeProp: flag('code-prop') });
  console.log(`Read ${features.length} features (name taken from "${m.nameProp}"). Matched ${m.matched.length} of ${ref.wards.length} wards.`);
  if (m.unmatchedWards.length) console.log(`\nWards with no polygon (${m.unmatchedWards.length}):\n  ${m.unmatchedWards.map((w) => w.name).join('\n  ')}`);
  if (m.unmatchedFeatures.length) console.log(`\nPolygons that matched no ward (${m.unmatchedFeatures.length}):\n  ${m.unmatchedFeatures.join('\n  ')}\n  -> if a name differs only in spelling, add it to ALIASES in scripts/lib/boundaries.mjs`);
  if (m.ambiguous.length) console.log(`\nNames that appeared on more than one polygon: ${m.ambiguous.map((a) => a.ward.name).join(', ')}`);
  if (m.matched.length < ref.wards.length * 0.95 && !has('allow-partial')) {
    console.error(`\nOnly ${m.matched.length} of ${ref.wards.length} matched. Fix the names above, or use --allow-partial to publish what matched (unmatched wards keep working without a shape).`);
    process.exit(1);
  }
  const refCentroids = new Map();
  const out = buildOutputs(m.matched, { countyBbox: ref.county.bbox, refCentroids });
  for (const w of out.warnings) console.warn(`  warning: ${w}`);
  mkdirSync(dirname(publicPath), { recursive: true });
  writeFileSync(publicPath, JSON.stringify(out.collection));
  mkdirSync(dirname(rowsPath), { recursive: true });
  writeFileSync(rowsPath, JSON.stringify(out.rows));
  console.log(`\nWrote ${publicPath} (${(JSON.stringify(out.collection).length / 1024).toFixed(0)} KB, ${out.collection.features.length} wards).`);
  console.log(`Next: commit that file so the map shows the real wards, then  node scripts/load-boundaries.mjs push ${slug}`);
}

async function push() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (not in a file that is committed).');
  if (!existsSync(rowsPath)) throw new Error(`Run "build" first (expected ${rowsPath}).`);
  const rows = JSON.parse(readFileSync(rowsPath, 'utf8'));
  let ok = 0;
  for (const r of rows) {
    const { id, ...patch } = r;
    const res = await fetch(`${url}/rest/v1/wards?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    if (res.ok) ok++; else console.error(`  ${id}: ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
  console.log(`Saved boundaries for ${ok} of ${rows.length} wards.`);
}

const run = { fetch: fetchOsm, build, push }[cmd];
if (!run) {
  console.error('usage: load-boundaries.mjs <fetch|build|push> <county slug> [options]   (see the comment at the top of this file)');
  process.exit(1);
}
Promise.resolve(run()).catch((e) => { console.error(e.message); process.exit(1); });
