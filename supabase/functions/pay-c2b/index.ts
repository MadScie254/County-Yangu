// Paybill payments made from the customer's own phone menu (no prompt from us). Safaricom calls twice:
//   ?stage=validation    "will you accept this payment?"  We accept: the money is already the customer's decision.
//   ?stage=confirmation  "it happened"                    We record it, and if the account number is an application
//                        reference for exactly that amount, we mark the application paid.
import { handler, HttpError, clientIp, readJson } from '../_shared/http.ts';
import { rpc } from '../_shared/db.ts';
import { callbackAuthorized, parseC2B } from '../_shared/mpesa.ts';

Deno.serve(handler('pay-c2b', async (req) => {
  const url = new URL(req.url);
  if (!callbackAuthorized(url, clientIp(req))) throw new HttpError(401, 'unauthenticated');
  if (url.searchParams.get('stage') === 'validation') return { ResultCode: 0, ResultDesc: 'Accepted' };

  const c = parseC2B(await readJson(req, 65_536));
  if (!c) throw new HttpError(400, 'bad_request');
  const outcome = await rpc<string>('svc_c2b_record', { p_trans_id: c.transId, p_amount: c.amount, p_bill_ref: c.billRef, p_payer_name: c.payerName, p_time: c.time.toISOString() });
  console.log('[pay-c2b]', outcome, c.transId);
  return { ResultCode: 0, ResultDesc: 'Accepted' };
}));
