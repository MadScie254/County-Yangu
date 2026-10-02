# Seed data

`nairobi-ward-rows.json` holds the 85 Nairobi ward boundaries in the shape `scripts/load-boundaries.mjs push` writes to
`public.wards` (geojson, bbox, centroid), coordinates rounded to 5 decimals (about 1 m). The same shapes are in
`public/geo/nairobi-wards.geojson` for the map.

Source: IEBC 2012 electoral ward boundaries, as published in the open `mikelmaron/kenya-election-data` repository
(`data/wards.geojson`), filtered to Nairobi (county code 47) and matched to our wards by IEBC ward code.

That file has no polygon for ward 1448 (Ngei, Mathare). Ngei's shape here is the gap its neighbours leave: the only
enclosed hole in the union of the other 84 wards that borders Mathare (about 0.26 km2, centred near -1.2564, 36.8665).
Replace it if the county GIS office supplies an official polygon.

Load into a database: `node scripts/load-boundaries.mjs push nairobi` (after `build`), or from SQL with pg_net by
fetching this file from the repository and updating `public.wards`.

## Public record data (`supabase/data`)

`supabase/data/nairobi_public_record.sql` loads Nairobi's real, sourced data: the governor's promises with their current
status (promise tracker) and county finance figures from the Controller of Budget and the Auditor-General. Every row
names its source and links to it; fields with no reliable published figure are left empty rather than estimated.
Load it only into the Nairobi project. It is safe to run again (rows are updated by slug, or by county and year).
Refresh statuses through the console (Promise tracker) so each change is kept in the public history.
