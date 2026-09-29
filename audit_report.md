# County Connect — Full Project Audit

> Scanned all 23 pages, 10 lib files, 7 components, 7 migrations, and 3 Edge Functions.

---

## 🔴 Critical Bugs (Breaking Right Now)

### 1. Revenue `addRevenueEntry` — Column Mismatch
**File:** [`mutations.ts:156`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/lib/mutations.ts#L156-L159)

The frontend sends `{ user: "...", time: "..." }` but the DB `revenue` table schema actually has a column literally named `"user"` (a reserved SQL keyword — bad schema design). Worse, the `RevenueEntry` TypeScript type uses `payer_name` and `created_at` instead of `user` and `time`. This causes silent type mismatches.

```diff
- export async function addRevenueEntry(entry: any) {  // `any` hides the type mismatch
+ export async function addRevenueEntry(entry: { ref: string; amount: number; user: string; stream: string; time: string; reconciled: boolean }) {
```

**Fix needed:** Rename `"user"` to `payer_name` in the DB and align frontend types.

---

### 2. Citizen Dashboard — Broken Application Detail Link
**File:** [`CitizenDashboard.tsx:131`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/CitizenDashboard.tsx#L131)

The "Details" link sends the user to `/applications` which just redirects back to `/dashboard`. It should navigate to the specific application.

```diff
- <Link to="/applications" className="...">Details</Link>
+ <Link to={`/applications/${app.id}`} className="...">Details</Link>
```

---

### 3. `ProtectedRoute` — Super Admin Can't Access Their Own Citizen Pages
**File:** [`ProtectedRoute.tsx:25-35`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/components/ProtectedRoute.tsx)

The logic is:
- If user `isAdmin` → allow everything (including citizen routes ✅)
- If route requires `admin` but user is `citizen` → redirect to `/dashboard`
- Normal `citizen` → allow ✅

**Bug:** A plain `citizen` trying to access `/admin` will just be silently redirected to `/dashboard` with no message. Also, `business` role is treated as `citizen` which may be intentional but needs auditing.

---

### 4. `MpesaModal` — Missing `reference` but Required by Edge Function
**File:** [`MpesaModal.tsx:31-38`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/components/MpesaModal.tsx#L31-L38)

The Edge Function requires `{ amount, phone, reference, description, applicationId }` but `MpesaModal` sends `reference` as a prop correctly. However, `TaxCompliance.tsx` calls `supabase.functions.invoke("mpesa-stk-push", ...)` with `accountReference` (wrong key name — should be `reference`) and no `applicationId` at all.

```diff
// TaxCompliance.tsx
- body: { phone, amount, accountReference: `SME-TAX-...` }
+ body: { phone, amount, reference: `SME-TAX-...`, applicationId: "tax", description: "SME Tax Payment" }
```

---

### 5. Duplicate RLS Policy Conflict on `applications` and `profiles`
**Database:** Found via MCP scan

There are **2 duplicate INSERT policies** on `applications`:
- `"Citizens can insert their own applications"`
- `"Users can insert own applications"`

And **2 duplicate UPDATE policies** on `profiles`:
- `"Users can update own profile"`
- `"Users can update their own profile"`

Duplicate policies can cause confusion and unexpected behavior. These should be cleaned up.

---

### 6. `revenue` Table — Missing `county_slug` Column
The `RevenueEntry` TypeScript type includes `county_slug` but the DB table has no such column. Any query filtering by county on revenue will silently fail.

---

## 🟠 Workflow Issues (UX Broken / Incomplete)

### 7. Land Registry Search — Fully Mocked (No Real Data)
**File:** [`LandRegistry.tsx:36-44`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/LandRegistry.tsx#L36-L44)

The "Verify Ownership" button always returns a hardcoded fake result regardless of what you search. The DB `land_records` table exists but the search never queries it.

```js
// Always returns the same fake result — not connected to DB
setVerificationResult({ owner: profile?.name || "Citizen", status: "Verified", ... });
```

**Fix:** Query `land_records` by parcel number or search term.

---

### 8. ApplicationForm — Phone Number Input on Step 5 Is Disconnected
**File:** [`ApplicationForm.tsx:341`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/ApplicationForm.tsx#L341)

Step 5 (Payment) has a phone number input field but the value is **never stored in state**. It's a dead input — what the user types there goes nowhere. The `MpesaModal` (opened on submit) requires them to re-enter their number.

```diff
- <input type="text" className="..." placeholder="07XX XXX XXX" />
+ <input type="text" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} ... />
```

---

### 9. Citizen Engagement — Grievance/Input Uses `mailto:` Instead of In-App Form
**File:** [`CitizenEngagement.tsx:20-27`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/CitizenEngagement.tsx#L20-L27)

Clicking "Submit Input" or "Lodge Grievance" opens the user's email client with a prefilled email. This is a terrible UX and breaks on devices without a mail client configured. There should be an in-app form that saves to the `notifications` or a `grievances` table.

---

### 10. Petition Voting — No Optimistic Update / Double-Vote Prevention
**File:** [`CitizenEngagement.tsx:13-16`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/CitizenEngagement.tsx#L13-L16)

Citizens can click the petition vote button multiple times and vote many times (there's no DB-level per-user vote tracking). Also no loading state — the UI hangs silently after clicking.

---

### 11. Revenue Live Ticker — Missing Empty State
**File:** [`RevenueCollection.tsx:62-66`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/RevenueCollection.tsx#L62-L66)

When `revenueEntries` is empty (fresh DB), the marquee ticker shows nothing and the animation looks broken. There's no empty state placeholder.

---

### 12. Admin Dashboard — Chart Data is Always Static (Not Live)
**File:** [`AdminDashboard.tsx:34-42`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/pages/AdminDashboard.tsx#L34-L42)

The revenue bar chart is hardcoded with mock data (`revenueData`). The actual live `revenues` array from Supabase is never used to populate the chart.

---

## 🟡 Security Issues

### 13. Credentials Hardcoded in Edge Function
**File:** [`supabase/functions/mpesa-stk-push/index.ts`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/supabase/functions/mpesa-stk-push/index.ts)

Daraja Sandbox credentials are now hardcoded as fallback values in the code (committed to Git). Before going to production, these **must** be moved to Supabase Edge Function Secrets (`DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, etc.) and the hardcoded values removed.

> [!CAUTION]
> Never commit API keys to source control, even sandbox ones. Rotate these before production.

---

### 14. `create_user.mjs` — Service Role Key in Repo
**File:** [`create_user.mjs`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/create_user.mjs)

This file contains a hardcoded Supabase **service role key** (admin-level access to your entire DB). It should be deleted from the repo and added to `.gitignore`.

---

### 15. `payments` Table Referenced But Never Created
The Edge Function tries to insert into a `payments` table (`adminClient.from("payments").insert(...)`) but there is **no migration creating this table**. Every STK Push will fail at the DB insert step with a 500 error after successfully charging the user!

---

## 🔵 Code Quality Issues

### 16. Massive Unused Imports Across Pages
Several pages import types that are never used. For example, `LandRegistry.tsx` and `TaxCompliance.tsx` import the entire type set (`Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, Petition...`) but use none of them — these came from a copy-paste template.

---

### 17. `useSupabase` Hook — `tableName` Excluded From `useEffect` Deps
**File:** [`useSupabase.ts:83`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/hooks/useSupabase.ts#L83)

`tableName` is used inside the effect but **not included in the dependency array**. If a component ever changes which table to query dynamically, the hook won't re-fetch. Should be `[tableName, queryOpts?.order, ...]`.

---

### 18. `addRevenueEntry` Uses `any` Type
**File:** [`mutations.ts:156`](file:///c:/Users/MadScie254/Documents/GitHub/County-Connect/src/lib/mutations.ts#L156)

Using `any` completely disables TypeScript checking. A strongly-typed interface should be used instead.

---

### 19. `serviceCatalog.ts` — Not Connected to Admin Services Table
Services in the citizen portal (ServiceCatalog, ApplicationForm) are sourced from the hardcoded `SERVICE_CATALOG` array in code, not from the `services` table in Supabase. This means if an admin creates a service in the Admin Services panel, citizens will **never see it**. These two systems are completely disconnected.

---

## 📋 Priority Fix Order

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 P0 | Create `payments` table migration (STK push crashes after charging) | Low |
| 🔴 P0 | Fix `MpesaModal`/`TaxCompliance` `reference` key mismatch | Low |
| 🔴 P0 | Fix broken "Details" link on Citizen Dashboard | Low |
| 🔴 P0 | Delete `create_user.mjs` with service role key | Low |
| 🟠 P1 | Connect `ApplicationForm` Step 5 phone input to state | Low |
| 🟠 P1 | Replace `mailto:` grievance flow with in-app form | Medium |
| 🟠 P1 | Clean up duplicate RLS policies | Low |
| 🟠 P1 | Connect Admin Services CRUD → Citizen ServiceCatalog | High |
| 🟠 P1 | Fix LandRegistry search to query real DB data | Medium |
| 🟡 P2 | Remove hardcoded credentials from Edge Function | Low |
| 🟡 P2 | Wire live revenue data into Admin Dashboard chart | Medium |
| 🟡 P2 | Add petition double-vote protection + loading state | Medium |
| 🟡 P2 | Add `county_slug` to revenue table or remove from type | Low |
| 🔵 P3 | Clean up massive unused type imports | Low |
| 🔵 P3 | Fix `useSupabase` missing `tableName` in dep array | Low |
| 🔵 P3 | Replace `any` in `addRevenueEntry` | Low |
