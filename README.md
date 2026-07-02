# County Yangu

County Yangu means "My County" in Swahili. This is a citizen-first public participation platform prototype for Bungoma County, Kenya.

The first screen is the public ward mosaic, not an admin dashboard. The app supports English and Swahili, public voting, anonymous-by-design issue reports, project tracking, public analytics, an oversight dashboard, installable PWA behavior, and offline queue states for votes and reports.

## Stack

- Next.js 16 App Router, React 19.2, Turbopack
- Tailwind CSS 4.3 with County Yangu tokens
- Radix UI unstyled primitives, reskinned locally
- Motion from `motion/react`
- MapLibre GL JS with OpenStreetMap raster tiles
- Nivo charts and a custom SVG/D3 budget flow
- TanStack Query, Zustand, React Hook Form, Zod
- next-intl with `/en` and `/sw` locale routes
- Serwist Turbopack service worker
- Supabase schema reference in `supabase/schema.sql`

## Routes

- `/en` and `/sw`: public home with live ward mosaic
- `/en/vote`: current budget-cycle vote flow with offline queue state
- `/en/report`: anonymous report flow with clear privacy explainer
- `/en/report/[reference]`: status lookup without report text or PII
- `/en/track`: searchable project tracker with list and map views
- `/en/track/[slug]`: project detail with milestones, budget, reports, and OG image
- `/en/pulse`: public analytics dashboard
- `/en/alerts`: SMS/USSD ward alert subscription
- `/en/how-it-works`: web, USSD, and IVR parity explanation
- `/en/assembly`: oversight dashboard demo

Switch `en` to `sw` for Swahili.

## Data Notes

`src/lib/data.ts` seeds all 45 Bungoma wards with real ward names and realistic civic metrics. The current mosaic uses a tessellated ward representation for the local demo. The intended production path is to source ward boundary GeoJSON/shapefiles from Kenya open boundary datasets, verify them against Bungoma County political units, then store canonical ward geometry in Supabase/PostGIS or Supabase Storage.

The Supabase SQL reference enables RLS, keeps public reads to safe tables/views, and does not expose raw phone numbers, report phone hashes, or individual report content to anonymous clients.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/en`.

## Verify

```bash
npm run lint
npm run build
```

The production build generates the Serwist service worker at `/serwist/sw.js`.
