import { Download } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useOcds, useTenders } from '@/shared/api/hooks';
import { getOcds } from '@/shared/api/loop';
import { downloadCsv } from '@/shared/lib/csv';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Card';

const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://YOUR-PROJECT.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? 'YOUR-PUBLISHABLE-KEY';
const endpoint = `${base}/rest/v1/rpc/ocds_releases`;
const open311 = `${base}/functions/v1/open311`;
const example = `curl -X POST '${endpoint}' \\
  -H 'apikey: ${key}' -H 'Content-Type: application/json' \\
  -d '{"p_limit": 100, "p_offset": 0}'`;

export default function OpenApi() {
  const { t } = useI18n();
  usePageTitle(t('loop.api.title'));
  const sample = useOcds(3);
  const tenders = useTenders();
  const download = async () => {
    const pkg = await getOcds(500, 0);
    const url = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'ocds-releases.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(1.9rem,5.5vw,2.8rem)] font-extrabold leading-tight">{t('loop.api.title')}</h1>
      <p className="mt-3 text-[1.05rem] text-ink-2">{t('loop.api.intro')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button icon={<Download className="size-4" aria-hidden />} onClick={() => void download()}>{t('loop.api.download')}</Button>
        <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!tenders.data?.length}
          onClick={() => downloadCsv('tenders.csv', (tenders.data ?? []).map((x) => ({ ...x })), ['reference', 'title', 'ward_name', 'sector', 'status', 'estimated_budget', 'applicants_count', 'awarded_to', 'procurement_method', 'award_amount', 'published_at', 'closes_at', 'awarded_at'])}>{t('loop.api.tendersCsv')}</Button>
      </div>

      <h2 className="mt-10 font-display text-xl font-bold">{t('loop.api.endpoint')}</h2>
      <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-bg-2 p-4 font-data text-sm">{endpoint}</pre>
      <h2 className="mt-6 font-display text-xl font-bold">{t('loop.api.example')}</h2>
      <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-bg-2 p-4 font-data text-sm">{example}</pre>
      <p className="mt-2 text-sm text-muted">{t('loop.api.limit')}</p>

      <h2 className="mt-8 font-display text-xl font-bold">{t('loop.api.fields')}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
        <li>{t('loop.api.f1')}</li>
        <li>{t('loop.api.f2')}</li>
        <li>{t('loop.api.f3')}</li>
      </ul>

      <h2 className="mt-10 font-display text-xl font-bold">{t('loop.api.open311')}</h2>
      <p className="mt-2 text-ink-2">{t('loop.api.open311Intro')}</p>
      <pre className="mt-2 overflow-x-auto rounded-2xl border border-line bg-bg-2 p-4 font-data text-sm">{`GET ${open311}/services.json
GET ${open311}/requests.json?status=open&start_date=2026-09-01
GET ${open311}/requests/{service_request_id}.json`}</pre>

      <h2 className="mt-8 font-display text-xl font-bold">{t('loop.api.sample')}</h2>
      {sample.isLoading ? <Skeleton className="mt-2 h-48" /> : (
        <pre className="mt-2 max-h-96 overflow-auto rounded-2xl border border-line bg-bg-2 p-4 font-data text-xs">{JSON.stringify(sample.data, null, 2)}</pre>
      )}
      <p className="mt-6 text-sm text-muted">{t('loop.api.license')}</p>
    </div>
  );
}
