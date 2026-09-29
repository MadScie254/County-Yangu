// My Services API. Live mode talks to Supabase under the applicant's own session (RLS decides what they
// can see); demo mode uses a localStorage stand-in. Prices are set by the database, never by the browser.
import { supabase, backendConfigured, functionsUrl } from './client';
import { dataSource } from './public';
import { demoCreateApplication, demoNotify, demoServices, readDb, writeDb } from './services-demo';
import type { AppNotification, Application, ApplicationDoc, PaymentState, Service } from './services-types';
import { sleep, uuid } from '@/shared/lib/utils';

const live = async () => (await dataSource()) === 'live' && Boolean(supabase);

export async function listServices(): Promise<Service[]> {
  if (!(await live())) return demoServices;
  const { data, error } = await supabase!.from('services').select('*').eq('status', 'active').order('name');
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function getService(slug: string): Promise<Service | null> {
  return (await listServices()).find((s) => s.slug === slug) ?? null;
}

export async function listMyApplications(): Promise<Application[]> {
  if (!(await live())) return readDb().applications;
  const { data, error } = await supabase!.from('applications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Application[];
}

export async function getApplication(id: string): Promise<{ app: Application; docs: ApplicationDoc[] } | null> {
  if (!(await live())) {
    const app = readDb().applications.find((a) => a.id === id);
    return app ? { app, docs: [] } : null;
  }
  const { data, error } = await supabase!.from('applications').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const docs = await supabase!.from('application_documents').select('*').eq('application_id', id);
  return { app: data as Application, docs: (docs.data ?? []) as ApplicationDoc[] };
}

export type DraftInput = { service_id: string; ward_id?: string | null; business_name?: string | null; kra_pin?: string | null; form_data: Record<string, string> };

export async function saveDraft(userId: string, input: DraftInput, existingId?: string): Promise<Application> {
  if (!(await live())) {
    if (existingId) {
      const db = readDb();
      const i = db.applications.findIndex((a) => a.id === existingId);
      if (i >= 0) {
        db.applications[i] = { ...db.applications[i]!, ...input, updated_at: new Date().toISOString() } as Application;
        writeDb(db);
        return db.applications[i]!;
      }
    }
    return demoCreateApplication(input.service_id, input);
  }
  if (existingId) {
    const { data, error } = await supabase!.from('applications').update({ ward_id: input.ward_id ?? null, business_name: input.business_name ?? null, kra_pin: input.kra_pin ?? null, form_data: input.form_data }).eq('id', existingId).select().single();
    if (error) throw error;
    return data as Application;
  }
  const { data, error } = await supabase!.from('applications').insert({ service_id: input.service_id, applicant_id: userId, ward_id: input.ward_id ?? null, business_name: input.business_name ?? null, kra_pin: input.kra_pin ?? null, form_data: input.form_data }).select().single();
  if (error) throw error;
  return data as Application;
}

/** Move a draft on: to awaiting_payment when there is a fee, otherwise straight to submitted. */
export async function submitApplication(app: Application): Promise<Application> {
  const next = app.amount > 0 ? 'awaiting_payment' : 'submitted';
  if (!(await live())) {
    const db = readDb();
    const i = db.applications.findIndex((a) => a.id === app.id);
    db.applications[i] = { ...db.applications[i]!, status: next, updated_at: new Date().toISOString() };
    writeDb(db);
    if (next === 'submitted') demoNotify({ title: `Application ${app.reference}`, message: 'Your application was received.', kind: 'success', link: `/services/applications/${app.id}` });
    return db.applications[i]!;
  }
  const { data, error } = await supabase!.from('applications').update({ status: next }).eq('id', app.id).select().single();
  if (error) throw error;
  return data as Application;
}

export async function uploadDocument(userId: string, appId: string, kind: string, file: Blob, ext: string): Promise<void> {
  if (!(await live())) return;
  const path = `${userId}/${appId}/${kind}-${Date.now()}.${ext}`;
  const up = await supabase!.storage.from('application-docs').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase!.from('application_documents').insert({ application_id: appId, kind, storage_path: path });
  if (error) throw error;
}

export async function startPayment(appId: string, phone: string): Promise<{ checkoutRequestId: string }> {
  if (!(await live()) || !functionsUrl) {
    await sleep(600);
    return { checkoutRequestId: `demo-${uuid()}` };
  }
  const { data: sess } = await supabase!.auth.getSession();
  const res = await fetch(`${functionsUrl}/mpesa-stk-push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, authorization: `Bearer ${sess.session?.access_token ?? ''}` },
    body: JSON.stringify({ application_id: appId, phone }),
  });
  const body = (await res.json().catch(() => ({}))) as { CheckoutRequestID?: string; checkout_request_id?: string; error?: string };
  if (!res.ok) throw new Error(body.error ?? `http-${res.status}`);
  return { checkoutRequestId: body.checkout_request_id ?? body.CheckoutRequestID ?? '' };
}

export async function getPaymentState(appId: string, checkoutRequestId: string): Promise<PaymentState> {
  if (checkoutRequestId.startsWith('demo-')) {
    // the "phone prompt" is answered after a few seconds in demo mode
    const started = Number(sessionStorage.getItem(`cy-pay-${checkoutRequestId}`) ?? Date.now());
    sessionStorage.setItem(`cy-pay-${checkoutRequestId}`, String(started));
    if (Date.now() - started < 4000) return { status: 'pending', mpesa_receipt: null };
    const db = readDb();
    const i = db.applications.findIndex((a) => a.id === appId);
    if (i >= 0 && db.applications[i]!.status === 'awaiting_payment') {
      db.applications[i] = { ...db.applications[i]!, status: 'submitted' };
      db.paid[appId] = `SIM${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      writeDb(db);
      demoNotify({ title: `Payment received`, message: `KES ${db.applications[i]!.amount.toLocaleString()} received. Your application is with the county.`, kind: 'success', link: `/services/applications/${appId}` });
    }
    return { status: 'completed', mpesa_receipt: readDb().paid[appId] ?? null };
  }
  const { data, error } = await supabase!.from('payments').select('status, mpesa_receipt').eq('application_id', appId).eq('checkout_request_id', checkoutRequestId).maybeSingle();
  if (error) throw error;
  return (data as PaymentState | null) ?? { status: 'pending', mpesa_receipt: null };
}

export async function listNotifications(): Promise<AppNotification[]> {
  if (!(await live())) return readDb().notifications;
  const { data, error } = await supabase!.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function markAllRead(): Promise<void> {
  if (!(await live())) {
    const db = readDb();
    db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
    writeDb(db);
    return;
  }
  await supabase!.from('notifications').update({ read: true }).eq('read', false);
}

export { backendConfigured };
