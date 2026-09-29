# Edge Function configuration

All secrets are Supabase Edge Function secrets (`supabase secrets set NAME=value`).
Nothing is read from source-code defaults.

## mpesa-stk-push
| Secret | Purpose |
|---|---|
| `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET` | Daraja app credentials |
| `DARAJA_PASSKEY`, `DARAJA_SHORTCODE` | STK push password inputs |
| `DARAJA_ENV` | `sandbox` (default) or `production` |
| `APP_URL` | Project base URL, e.g. `https://<ref>.supabase.co` |
| `MPESA_CALLBACK_SECRET` | Random string (`openssl rand -hex 32`); appended to the callback URL |

## mpesa-webhook
Deploy with `supabase functions deploy mpesa-webhook --no-verify-jwt`
(Safaricom cannot send a Supabase JWT). It rejects requests whose `?token=`
does not match `MPESA_CALLBACK_SECRET`, and returns 503 if the secret is unset.

| Secret | Purpose |
|---|---|
| `MPESA_CALLBACK_SECRET` | Same value as above |
| `MPESA_ALLOWED_IPS` | Optional comma-separated Safaricom source IPs; when set, other IPs are rejected |
