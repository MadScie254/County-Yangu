# Edge Functions

Everything that reaches outside the database, or that a resident or a phone network calls, lives here. There is one Supabase project **per county**, and each county deploys these same functions with its own secrets.

## The rules these functions follow

1. **Public writes only come through here.** Residents and visitors have no INSERT rights on any table. A report, a vote, an alert sign-up and an idea are each validated, rate-limited and written by a function using the service role.
2. **The functions are thin; the database holds the rules.** Each function validates its input, talks to the outside world (SMS, M-Pesa, the AI provider), then calls one `svc_*` function in the database (`supabase/migrations/…_service_api.sql`). One vote per person, a code that locks after five tries, a payment that settles exactly once: those live next to the data and are covered by `npm run test:db`.
3. **`svc_*` functions can only be called by the service role.** A signed-in user, even an administrator, cannot call them. A test asserts it.
4. **Nothing personal is stored that does not need to be.** Votes and "one person, one vote" checks use a keyed hash of the phone number. A report carries no reporter identity; a callback number is opt-in and kept apart. USSD reports store no number at all.
5. **The AI never acts.** It drafts text, or it picks one of six fixed, read-only questions which the database runs *as the person asking*. Every call is redacted, budget-checked and logged with its cost.
6. **Errors never explain themselves.** Unexpected failures are logged server-side and the caller sees `server_error`.

## Endpoints

| Function | Called by | Proves who it is by | What it does |
|---|---|---|---|
| `report-intake` | resident app | rate limit (hashed address) | Validate, scrub personal details, resolve ward from a pin, sanitise photos (EXIF stripped, type checked by bytes), create the case |
| `otp-request` / `otp-verify` | resident app | rate limits (address, number, county-wide) | Send a six-digit code by SMS; check it; return a 30-minute signed token bound to the phone and purpose |
| `vote` | resident app | verified-phone token | One vote per person per round, shared with USSD |
| `case-feedback` | resident app | case reference, rate limits (address, reference) | "Was it fixed?": a yes is counted, a no reopens the case |
| `alerts-subscribe` | resident app | verified-phone token | Subscribe a phone to a ward; confirm by SMS |
| `proposal-submit` / `proposal-support` | resident app | verified-phone token | Post or back an idea/petition (text scrubbed: ideas are public at once) |
| `ussd-gateway` | Africa's Talking | secret token in the URL (+ optional IP list) | The USSD menu: report, check, budget vote, alerts; English and Kiswahili |
| `sms-inbound` | Africa's Talking | secret token in the URL | `STOP`, `STATUS <ref>`, help |
| `sms-hook` | Supabase Auth | Standard Webhooks signature | Deliver Assembly members' phone sign-in codes |
| `pay-start` | resident app (signed in) | Supabase Auth token | STK push. The amount and ownership come from the database, never the request |
| `pay-callback` | Safaricom | secret token in the URL (+ optional IP list) | Settle an STK push: idempotent, wrong amounts never applied |
| `pay-c2b` | Safaricom | secret token in the URL | Paybill payments: match an application reference, else record for finance |
| `outbox-worker` | pg_cron, every minute | `x-cron-secret` | Turn approved alerts into messages, send the outbox with retries |
| `escalation-runner` | pg_cron, hourly | `x-cron-secret` | Walk overdue cases up the ladder, notify the right people |
| `digest-builder` | pg_cron | `x-cron-secret` | Monthly oversight digests; daily/weekly ward SMS summaries |
| `digest-open` | link in a digest email | unguessable token | Record that a recipient opened it, redirect to the console |
| `ai-gateway` | console (signed in) | Supabase Auth token + role | Draft a reply / answer a data question, within the department's monthly cap |
| `auditor-invite` | console (administrator) | Supabase Auth token + role | Email a single-use, expiring invitation (only its hash is stored) |
| `auditor-accept` | invited auditor | invitation token + matching email | Create the account with a time-limited, read-only role |
| `kra-check` | console (publishers) | Supabase Auth token + role | PIN format check; live KRA lookup is a documented seam (see below) |

> The payment functions are called `pay-*`, not `mpesa-*`: Safaricom rejects callback URLs that contain the word "mpesa".

`verify_jwt` is off for all of them (`supabase/config.toml`). Each one authenticates its caller itself, as the table says, and the public ones are called with only the publishable key.

## Setup

```bash
# 1. secrets (copy supabase/.env.example to supabase/.env, fill it in; it is gitignored)
supabase secrets set --env-file supabase/.env

# 2. deploy
supabase functions deploy --project-ref <ref>      # all of them

# 3. schedule the jobs (SQL editor; edit the two values at the top first)
#    supabase/ops/schedule-jobs.sql

# 4. give Africa's Talking these callback URLs
#    USSD:         https://<ref>.supabase.co/functions/v1/ussd-gateway?token=<USSD_CALLBACK_TOKEN>
#    Inbound SMS:  https://<ref>.supabase.co/functions/v1/sms-inbound?token=<SMS_CALLBACK_TOKEN>
# 5. register Daraja's C2B URLs (confirmation and validation) with:
#    https://<ref>.supabase.co/functions/v1/pay-c2b?stage=confirmation&token=<MPESA_CALLBACK_TOKEN>
#    https://<ref>.supabase.co/functions/v1/pay-c2b?stage=validation&token=<MPESA_CALLBACK_TOKEN>
# 6. Supabase Auth > Hooks > Send SMS > HTTPS: .../functions/v1/sms-hook   (secret goes in SEND_SMS_HOOK_SECRET)
```

`COUNTY_SERVICE_KEY` (optional) is a new-style secret key (`sb_secret_...`). Functions use it before the legacy `service_role` key, so the legacy JWT keys can be disabled. Order: `COUNTY_SERVICE_KEY`, then `SUPABASE_SECRET_KEYS`, then `SUPABASE_SERVICE_ROLE_KEY` (and the same for the publishable key).

`COUNTY_HMAC_SECRET` keys every phone hash, voter hash and token. **Do not change it during a voting round**: every voter hash would change and people could vote again.

Anything left unset fails safe: callbacks with no configured token are refused, SMS and email use a mock that sends nothing, the AI uses a labelled mock, `pay-start` answers `not_configured`.

## Tests

```bash
npm test                 # unit tests: crypto, tokens, PII scrub, geometry, image sanitising, USSD menu, adapters, AI planner
npm run test:db          # the schema, row-level security and the service API, in an embedded Postgres
npm run test:edge        # the real handlers over HTTP against a fake database and providers (needs Deno)
npm run check:edge       # deno check on every function
```

## Known limits (be honest about these)

* **Ward boundaries.** Until `wards.geojson` is loaded, a dropped pin is only sanity-checked (it must be within 20 km of the chosen ward), not used to choose the ward.
* **KRA.** `kra-check` validates PIN format only. GavaConnect's request and response shapes are in KRA's developer-portal documentation and need county credentials; until `lookupPin` in `_shared/kra.ts` is completed against them, the status is "unknown" and nobody is shown as tax compliant.
* **Ideas are public immediately.** Personal details are scrubbed and posting is rate limited, but there is no moderation queue yet.
* **Free-text names.** The scrubber removes phone numbers, emails, KRA PINs and labelled ID numbers. It does not find names.
* **AI prices** in `_shared/llm.ts` are approximate defaults that drive the monthly cap, not billing. Override with `AI_KES_PER_MTOK_IN/OUT`.
* **Swahili** menu and SMS copy needs review by a native speaker before launch.
