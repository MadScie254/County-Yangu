// Safaricom's result for an STK push. Unsigned, so the URL carries a secret token (and, optionally, Safaricom's addresses).
// Settlement is idempotent in the database: a callback delivered twice changes nothing the second time, and a payment for
// the wrong amount is never applied.
import { handler, HttpError, clientIp, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { callbackAuthorized, parseStkCallback } from '../_shared/mpesa.ts';

Deno.serve(handler('pay-callback', async (req) => {
  if (!callbackAuthorized(new URL(req.url), clientIp(req))) throw new HttpError(401, 'unauthenticated');
  const result = parseStkCallback(await readJson(req, 65_536));
  if (!result) throw new HttpError(400, 'bad_request');

  const outcome = await rpc<string>('svc_payment_settle', {
    p_checkout: result.checkoutRequestId, p_result_code: result.resultCode, p_receipt: result.receipt, p_amount: result.amount, p_last4: result.last4,
  });
  console.log('[pay-callback]', outcome, result.checkoutRequestId); // no phone numbers, no names
  // Always acknowledge a well-formed, authorised callback so Safaricom stops retrying; the outcome is in our own records.
  return { ResultCode: 0, ResultDesc: 'Accepted' };
}));
