import type { CountyFinance } from '@/shared/api/types';

export type FinanceRow = Omit<CountyFinance, 'updated_at'>;
export const FINANCE_COLUMNS = ['county', 'fiscal_year', 'dev_budget', 'dev_spent', 'rec_budget', 'rec_spent', 'osr_target', 'osr_actual', 'pending_bills', 'audit_opinion', 'source', 'source_url'] as const;
const OPINIONS = ['unqualified', 'qualified', 'adverse', 'disclaimer'] as const;
const NUMERIC = ['dev_budget', 'dev_spent', 'rec_budget', 'rec_spent', 'osr_target', 'osr_actual', 'pending_bills'] as const;

/** Split CSV text into rows, honouring double-quoted fields (which may hold commas, quotes and line breaks). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Read a county finance sheet (one row per county and year, figures in shillings) into rows the database accepts.
 * The county column takes the official code (1 to 47) or the name. Bad rows are reported, never guessed.
 */
export function parseFinanceCsv(text: string, counties: [number, string][]): { rows: FinanceRow[]; errors: string[] } {
  const all = splitCsv(text.replace(/^\uFEFF/, ''));
  if (all.length < 2) return { rows: [], errors: ['The file has no data rows.'] };
  const head = all[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (name: string) => head.indexOf(name === 'county' && !head.includes('county') ? 'county_code' : name);
  const missing = ['county', 'fiscal_year', 'source'].filter((c) => col(c) < 0);
  if (missing.length) return { rows: [], errors: [`Missing column: ${missing.join(', ')}.`] };
  const byName = new Map(counties.map(([code, name]) => [norm(name), code]));
  const rows: FinanceRow[] = [], errors: string[] = [];
  all.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (c: string) => { const k = col(c); return k < 0 ? '' : (r[k] ?? '').trim(); };
    const cv = get('county');
    const code = /^\d+$/.test(cv) ? Number(cv) : byName.get(norm(cv));
    if (!code || code < 1 || code > 47) return void errors.push(`Row ${line}: unknown county "${cv}".`);
    const fy = get('fiscal_year');
    if (!/^20\d{2}\/\d{2}$/.test(fy)) return void errors.push(`Row ${line}: financial year must look like 2024/25.`);
    const source = get('source');
    if (source.length < 3) return void errors.push(`Row ${line}: say where the figures come from.`);
    const url = get('source_url');
    if (url && !/^https:\/\//.test(url)) return void errors.push(`Row ${line}: the source link must start with https://.`);
    const op = get('audit_opinion').toLowerCase();
    if (op && !(OPINIONS as readonly string[]).includes(op)) return void errors.push(`Row ${line}: audit opinion must be one of ${OPINIONS.join(', ')}.`);
    const out = { county_code: code, fiscal_year: fy, audit_opinion: (op || null) as FinanceRow['audit_opinion'], source, source_url: url || null } as FinanceRow;
    for (const k of NUMERIC) {
      const raw = get(k).replace(/[\s,]/g, '').replace(/^KES/i, '');
      if (raw === '') { out[k] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return void errors.push(`Row ${line}: ${k} is not a number.`);
      out[k] = n;
    }
    rows.push(out);
  });
  return { rows, errors };
}
