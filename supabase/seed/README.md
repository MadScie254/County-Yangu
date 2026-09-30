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
