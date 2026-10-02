import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Upload } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useCountyFinance } from '@/shared/api/hooks';
import { KENYA_COUNTIES, countyName, saveCountyFinance } from '@/shared/api/civic2';
import { FINANCE_COLUMNS, parseFinanceCsv, type FinanceRow } from '@/shared/lib/financeCsv';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { toast } from '@/shared/ui/Toast';
import { PageHeader, Panel } from '../ui/Page';

const template = `${FINANCE_COLUMNS.join(',')}\nNairobi,2024/25,44000000000,26400000000,,,20000000000,13800000000,90000000000,qualified,Controller of Budget CGBIRR FY 2024/25,https://cob.go.ke/\n`;

/** Load every county's spending, revenue and audit figures from a spreadsheet, for the public comparison at /counties. */
export default function CountyFinance() {
  usePageTitle('County finances', 'CountyConnect');
  const { kes, number } = useI18n();
  const qc = useQueryClient();
  const q = useCountyFinance();
  const [parsed, setParsed] = useState<{ rows: FinanceRow[]; errors: string[]; name: string } | null>(null);
  const save = useMutation({
    mutationFn: () => saveCountyFinance(parsed!.rows),
    onSuccess: () => { toast({ tone: 'good', title: `Saved ${parsed!.rows.length} rows. They are public now.` }); setParsed(null); void qc.invalidateQueries({ queryKey: ['county-finance'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'Nothing was saved', body: e instanceof Error ? e.message : 'Only administrators can load figures.' }),
  });
  const read = async (file: File) => setParsed({ ...parseFinanceCsv(await file.text(), KENYA_COUNTIES), name: file.name });
  const years = [...new Set((q.data ?? []).map((r) => r.fiscal_year))].sort().reverse();

  return (
    <>
      <PageHeader title="County finances" subtitle="Figures for all 47 counties from the Controller of Budget's implementation reviews and the Auditor-General's reports. Residents compare them at /counties. Every row must name its source." />
      <div className="space-y-6">
        <Panel title="Load a spreadsheet">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>Download the template and fill one row per county and year. Amounts in shillings; leave a cell empty if the report does not give it.</li>
            <li>Save it as CSV and choose it below. Nothing is saved until you check the preview.</li>
            <li>Loading a county and year that already exists replaces it.</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="county-finance-template.csv"><Download className="size-4" aria-hidden />Template</a>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold hover:bg-bg-2">
              <Upload className="size-4" aria-hidden />Choose CSV file
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
            </label>
          </div>
          {parsed && (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold">{parsed.name}: {parsed.rows.length} rows ready{parsed.errors.length ? `, ${parsed.errors.length} with problems` : ''}.</p>
              {parsed.errors.length > 0 && <ul className="max-h-40 list-disc overflow-auto rounded-xl bg-bad-soft p-3 pl-7 text-sm">{parsed.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              {parsed.rows.length > 0 && (
                <div className="max-h-72 overflow-auto rounded-xl border border-line">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead><tr className="bg-bg-2 text-left text-xs text-muted"><th className="px-3 py-2">County</th><th className="px-3 py-2">Year</th><th className="px-3 py-2 text-right">Dev budget</th><th className="px-3 py-2 text-right">Dev spent</th><th className="px-3 py-2 text-right">Pending bills</th><th className="px-3 py-2">Audit</th></tr></thead>
                    <tbody className="divide-y divide-line">{parsed.rows.map((r) => (
                      <tr key={`${r.county_code}-${r.fiscal_year}`}><td className="px-3 py-1.5">{countyName.get(r.county_code)}</td><td className="px-3 py-1.5">{r.fiscal_year}</td>
                        <td className="px-3 py-1.5 text-right font-data">{r.dev_budget === null ? '-' : kes(r.dev_budget, { compact: true })}</td><td className="px-3 py-1.5 text-right font-data">{r.dev_spent === null ? '-' : kes(r.dev_spent, { compact: true })}</td>
                        <td className="px-3 py-1.5 text-right font-data">{r.pending_bills === null ? '-' : kes(r.pending_bills, { compact: true })}</td><td className="px-3 py-1.5">{r.audit_opinion ?? '-'}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-2">
                <Button icon={<Upload className="size-4" aria-hidden />} disabled={!parsed.rows.length} loading={save.isPending} onClick={() => save.mutate()}>Save {parsed.rows.length} rows</Button>
                <Button variant="ghost" onClick={() => setParsed(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </Panel>
        <Panel title="What is loaded">
          {years.length === 0 ? <p className="text-sm text-muted">Nothing yet.</p> : (
            <ul className="space-y-1 text-sm">{years.map((y) => <li key={y}>{y}: {number((q.data ?? []).filter((r) => r.fiscal_year === y).length)} of 47 counties</li>)}</ul>
          )}
        </Panel>
      </div>
    </>
  );
}
