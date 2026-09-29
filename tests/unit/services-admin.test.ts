import { describe, it, expect } from 'vitest';
import { validateService } from '../../src/console/pages/admin/ServicesTab';
import type { ServiceInput } from '../../src/console/api/admin';

const base: ServiceInput = { slug: 'x', name: 'Single Business Permit', name_sw: null, category: 'permit', description: null, fee: 5000, fee_note: null, requires_kra_pin: true, form_schema: [], required_documents: [], sla_working_days: 7, status: 'draft', department_id: null };
const field = (over = {}) => ({ key: 'plot_number', type: 'text' as const, en: 'Plot number', sw: '', required: true, options: '', ...over });

describe('service editor validation', () => {
  it('accepts a sound service and form', () => {
    expect(validateService(base, [field(), field({ key: 'use', type: 'select', en: 'Use', options: 'res | Residential | Makazi\ncom | Commercial' })])).toBeNull();
  });

  it('refuses a service the resident form or M-Pesa could not handle', () => {
    expect(validateService({ ...base, name: 'x' }, [])).toMatch(/name/);
    expect(validateService({ ...base, fee: -1 }, [])).toMatch(/negative/);
    expect(validateService({ ...base, fee: 100.5 }, [])).toMatch(/whole shillings/);
    expect(validateService({ ...base, sla_working_days: 0 }, [])).toMatch(/working days/);
  });

  it('refuses broken fields: bad or duplicate keys, missing labels, selects without choices', () => {
    expect(validateService(base, [field({ key: 'Plot Number' })])).toMatch(/lowercase/);
    expect(validateService(base, [field({ key: '' })])).toMatch(/key/);
    expect(validateService(base, [field(), field()])).toMatch(/share the key/);
    expect(validateService(base, [field({ en: ' ' })])).toMatch(/label/);
    expect(validateService(base, [field({ type: 'select', options: 'only-a-value' })])).toMatch(/at least one choice/);
  });
});
