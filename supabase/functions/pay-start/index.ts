// "Pay with M-Pesa" for an application. The browser says WHICH application; the server looks up who owns it and what it
// costs, so an applicant can neither pay for someone else's application nor choose their own price.
// (Named pay-*, not mpesa-*: Safaricom rejects callback URLs that contain the word "mpesa".)
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { rpc } from '../_shared/db.ts';
import { darajaConfig, stkPush } from '../_shared/daraja.ts';
import { env } from '../_shared/env.ts';
import { limit } from '../_shared/participation.ts';
import { last4, toE164Kenya, toMsisdn } from '../_shared/phone.ts';
import { str, uuid } from '../_shared/validate.ts';

Deno.serve(handler('pay-start', async (req) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const application = uuid(body, 'application_id');
  const phone = toE164Kenya(str(body, 'phone', 7, 20));
  if (!phone) throw new HttpError(422, 'invalid_request', { field: 'phone' });
  await limit(`stk:user:${user.id}`, 600, 5);

  const prep = await rpc<{ status: string; reference?: string; amount?: number; service?: string }>('svc_payment_prepare', { p_application: application, p_user: user.id });
  if (prep.status === 'not_found') throw new HttpError(404, 'not_found');
  if (prep.status === 'pending_exists') throw new HttpError(409, 'payment_pending');
  if (prep.status !== 'ok') throw new HttpError(409, 'not_payable');
  const amount = Number(prep.amount);
  // Daraja takes whole shillings only, and the callback amount must equal what we recorded
  if (!Number.isInteger(amount) || amount < 1) throw new HttpError(409, 'not_payable');

  const cfg = darajaConfig();
  const base = env('SUPABASE_URL');
  if (!base) throw new HttpError(503, 'not_configured');
  const { checkoutRequestId } = await stkPush(cfg, {
    amount, msisdn: toMsisdn(phone), reference: prep.reference ?? 'COUNTY', description: 'County fee',
    callbackUrl: `${base}/functions/v1/pay-callback?token=${cfg.callbackToken}`,
  });
  await rpc('svc_payment_record', { p_application: application, p_user: user.id, p_checkout: checkoutRequestId, p_amount: amount, p_last4: last4(phone) });
  return { checkout_request_id: checkoutRequestId };
}));
