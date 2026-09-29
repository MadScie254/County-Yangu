# Changelog

All notable changes to CountyConnect will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Multi-county admin super-dashboard
- Offline-first PWA sync for low-connectivity counties
- Africa's Talking USSD gateway activation
- OAuth via Google and eCitizen SSO
- Final M-Pesa payment reconciliation loop

---

## [1.2.0] – 2026-06-21

### Added
- `profiles` table with RLS policies and auto-created on signup trigger
- `county_slug` column persisted to user profile on registration and login
- Supabase Storage buckets: `avatars` (public) and `applications-documents` (private)
- File upload support in `ApplicationForm` — business cert and KRA PIN cert
- Signed URL download of uploaded documents in `ApplicationReview`
- `UserProfile` page with avatar upload and live Supabase profile sync
- `syncProfileCounty` mutation to keep county selection tied to auth session
- Admin can now trigger citizen notifications on application status change
- `ToastContext` provider and `useToast` hook for global in-app notifications
- `ConfigBanner` component to warn when Supabase env vars are missing

### Changed
- `ProtectedRoute` now reads role from `profiles.role` via `AuthContext`
- `DashboardLayout` unread count driven by live `useMyNotifications` hook
- `LiveAlerts` simulation wired through `store.ts` event bus
- All admin write policies migrated from email-keyed to role-based RLS

### Fixed
- `window.fetch` patch in `index.html` preventing Supabase SDK conflicts
- Duplicate `ServiceItem` type import resolved across import fix scripts

---

## [1.1.0] – 2026-06-17

### Added
- Full Supabase schema: `applications`, `services`, `tenders`, `departments`,
  `notifications`, `revenue`, `health_drugs`, `welfare`, `petitions`,
  `land_records`, `anomalies`
- Row Level Security enabled on all tables with citizen and admin policies
- `useSupabase` generic hook with real-time Postgres change subscriptions
- `store.ts` reactive data layer replacing all mock in-memory state
- `mutations.ts` — typed write helpers for all major entities
- M-Pesa STK Push Edge Function (`supabase/functions/mpesa-stk-push`)
- M-Pesa webhook handler (`supabase/functions/mpesa-webhook`)
- USSD Gateway stub (`supabase/functions/ussd-gateway`)
- `MpesaModal` component for citizen-facing payment flow
- `AdminActionModal` built on Radix UI Dialog with Motion animations
- PDF report export using jsPDF + jsPDF-AutoTable in `utils.ts`
- County-aware pricing catalog across all 47 Kenyan counties

### Changed
- `App.tsx` routes now wrapped in `ProtectedRoute` with role awareness
- `AuthContext` introduced for session and profile state management
- County selection persisted to `localStorage` and synced to Supabase profile

### Removed
- All static mock data stores (`getApplications`, `getTenders`, etc.)
- Legacy `fix-imports-*.js` scripts (migration artifacts, retained for reference)

---

## [1.0.0] – 2026-06-01

### Added

- Initial React 19 + Vite 6 + Tailwind CSS 4 project scaffold
- Public landing page with county-aware pricing and 47-county catalog
- Citizen portal: dashboard, service catalog, application form (multi-step)
- Admin portal: executive dashboard, applications queue, analytics, settings
- Vertical modules: Land Registry, Tax Compliance (KRA Bridge), Social Welfare,
  Citizen Engagement, Procurement, Revenue Collection, Public Health, API Hub
- `DashboardLayout` shell with role-aware sidebar navigation
- Recharts integration for revenue and analytics visualisations
- Motion (Framer Motion) page and card animations
- TypeScript strict typing across all pages, hooks, and lib modules
- PWA manifest via `vite-plugin-pwa`
