// Is this KRA PIN well formed, and (once the county has GavaConnect credentials) is the taxpayer compliant?
// For a contractor, the result is saved on the contractor record. Only staff who publish tenders may use it.
import { handler, HttpError, readJson } from '../_shared/http.ts';
import { PUBLISHER_ROLES, requireRole } from '../_shared/auth.ts';
import { rpc } from '../_shared/db.ts';
import { checkPin } from '../_shared/kra.ts';
import { limit } from '../_shared/participation.ts';
import { isUuid, str } from '../_shared/validate.ts';

Deno.serve(handler('kra-check', async (req) => {
  const caller = await requireRole(req, PUBLISHER_ROLES);
  const body = await readJson(req);
  const pin = str(body, 'pin', 5, 20);
  await limit(`kra:${caller.id}`, 3600, 60);

  const result = await checkPin(pin).catch((e) => {
    console.error('[kra-check]', e instanceof Error ? e.message : String(e));
    throw new HttpError(502, 'kra_unavailable');
  });
  // only KRA's own answer changes what the public sees; a format check or "unknown" never marks anyone compliant
  if (isUuid(body.contractor_id) && result.source === 'gavaconnect' && result.status !== 'unknown') {
    await rpc('svc_kra_record', { p_contractor: body.contractor_id, p_compliant: result.status === 'compliant' });
  }
  return result;
}));
