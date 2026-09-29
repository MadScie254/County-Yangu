// Sample catalogue and a tiny localStorage "backend" so My Services can be explored end to end
// before a county's database is connected. Never used when a backend is reachable.
import type { Application, AppNotification, Service } from './services-types';
import { uuid } from '@/shared/lib/utils';
import { county } from '@/shared/config/county';

const yesNo = [{ value: 'yes', label: { en: 'Yes', sw: 'Ndiyo' } }, { value: 'no', label: { en: 'No', sw: 'Hapana' } }];

export const demoServices: Service[] = [
  {
    id: 'svc-sbp', slug: 'single-business-permit', name: 'Single Business Permit', name_sw: 'Leseni Moja ya Biashara', category: 'permit',
    description: 'Licence to trade in the county for one year. Renew every January.', fee: 5000, fee_note: 'Fee depends on business class; the amount shown is for a small trader. Confirm against the county fee schedule.', requires_kra_pin: true, sla_working_days: 7, status: 'active',
    required_documents: ['id_copy', 'kra_pin_certificate'],
    form_schema: [
      { key: 'business_activity', type: 'text', required: true, label: { en: 'What does the business do?', sw: 'Biashara inafanya nini?' } },
      { key: 'premises', type: 'select', required: true, label: { en: 'Where does it operate?', sw: 'Inafanyia wapi?' }, options: [{ value: 'shop', label: { en: 'Shop or office', sw: 'Duka au ofisi' } }, { value: 'market', label: { en: 'Market stall', sw: 'Kibanda sokoni' } }, { value: 'mobile', label: { en: 'Mobile / hawking', sw: 'Ya kuzungusha' } }] },
      { key: 'employees', type: 'number', label: { en: 'Number of employees', sw: 'Idadi ya wafanyakazi' }, max: 500 },
      { key: 'address', type: 'text', required: true, label: { en: 'Street or building', sw: 'Barabara au jengo' } },
    ],
  },
  {
    id: 'svc-rates', slug: 'land-rates', name: 'Land rates payment', name_sw: 'Malipo ya kodi ya ardhi', category: 'rates',
    description: 'Pay your annual land rates and get a clearance certificate.', fee: 0, fee_note: 'The amount is your assessed rates balance. Enter the plot number to look it up.', requires_kra_pin: false, sla_working_days: 3, status: 'active',
    required_documents: [],
    form_schema: [
      { key: 'plot_number', type: 'text', required: true, label: { en: 'Plot / LR number', sw: 'Nambari ya kiwanja / LR' }, help: { en: 'For example: 209/1234', sw: 'Kwa mfano: 209/1234' } },
      { key: 'owner_name', type: 'text', required: true, label: { en: 'Owner name as on the title', sw: 'Jina la mmiliki kama kwenye hati' } },
    ],
  },
  {
    id: 'svc-plan', slug: 'building-plan-approval', name: 'Building plan approval', name_sw: 'Idhini ya mpango wa jengo', category: 'planning',
    description: 'Submit building plans for county approval before you build.', fee: 25000, fee_note: 'Approximate. The fee follows the estimated construction cost.', requires_kra_pin: false, sla_working_days: 21, status: 'active',
    required_documents: ['id_copy', 'title_or_lease', 'architectural_drawings'],
    form_schema: [
      { key: 'plot_number', type: 'text', required: true, label: { en: 'Plot / LR number', sw: 'Nambari ya kiwanja / LR' } },
      { key: 'use', type: 'select', required: true, label: { en: 'Type of building', sw: 'Aina ya jengo' }, options: [{ value: 'residential', label: { en: 'Residential', sw: 'Makazi' } }, { value: 'commercial', label: { en: 'Commercial', sw: 'Biashara' } }, { value: 'mixed', label: { en: 'Mixed use', sw: 'Matumizi mchanganyiko' } }] },
      { key: 'storeys', type: 'number', required: true, label: { en: 'Number of storeys', sw: 'Idadi ya ghorofa' }, max: 60 },
      { key: 'has_nca', type: 'select', required: true, label: { en: 'Is a registered architect or engineer involved?', sw: 'Je, mbunifu au mhandisi aliyesajiliwa anahusika?' }, options: yesNo },
    ],
  },
  {
    id: 'svc-parking', slug: 'seasonal-parking', name: 'Seasonal parking', name_sw: 'Maegesho ya msimu', category: 'permit',
    description: 'A monthly parking sticker for designated county zones.', fee: 3000, fee_note: null, requires_kra_pin: false, sla_working_days: 2, status: 'active',
    required_documents: ['logbook'],
    form_schema: [
      { key: 'registration', type: 'text', required: true, label: { en: 'Vehicle registration', sw: 'Nambari ya usajili wa gari' }, pattern: '^K[A-Z]{2} ?\\d{3}[A-Z]$' },
      { key: 'zone', type: 'select', required: true, label: { en: 'Parking zone', sw: 'Eneo la maegesho' }, options: [{ value: 'cbd', label: { en: 'CBD', sw: 'Katikati ya jiji' } }, { value: 'estates', label: { en: 'Estates', sw: 'Mitaa' } }] },
    ],
  },
  {
    id: 'svc-bursary', slug: 'county-bursary', name: 'County bursary', name_sw: 'Basari ya kaunti', category: 'welfare',
    description: 'Fee support for needy students in secondary school, college and university.', fee: 0, fee_note: 'Free to apply.', requires_kra_pin: false, sla_working_days: 30, status: 'active',
    required_documents: ['id_copy', 'admission_letter', 'fee_structure'],
    form_schema: [
      { key: 'institution', type: 'text', required: true, label: { en: 'School or college', sw: 'Shule au chuo' } },
      { key: 'level', type: 'select', required: true, label: { en: 'Level', sw: 'Kiwango' }, options: [{ value: 'secondary', label: { en: 'Secondary', sw: 'Sekondari' } }, { value: 'tertiary', label: { en: 'College / university', sw: 'Chuo / chuo kikuu' } }] },
      { key: 'ward', type: 'ward', required: true, label: { en: 'Ward of residence', sw: 'Wadi unayoishi' } },
      { key: 'reason', type: 'textarea', required: true, label: { en: 'Why do you need support?', sw: 'Kwa nini unahitaji msaada?' }, max: 600 },
    ],
  },
  {
    id: 'svc-health', slug: 'health-facility-booking', name: 'Health facility booking', name_sw: 'Kuweka miadi ya kituo cha afya', category: 'health',
    description: 'Book an appointment at a county Level 2–4 health facility.', fee: 0, fee_note: 'Free to book. Service fees apply at the facility.', requires_kra_pin: false, sla_working_days: 1, status: 'active',
    required_documents: [],
    form_schema: [
      { key: 'facility', type: 'text', required: true, label: { en: 'Which facility?', sw: 'Kituo gani?' } },
      { key: 'preferred_date', type: 'date', required: true, label: { en: 'Preferred date', sw: 'Tarehe unayopendelea' } },
      { key: 'reason', type: 'textarea', label: { en: 'Reason for visit (optional)', sw: 'Sababu ya kutembelea (si lazima)' }, max: 300 },
    ],
  },
];

const KEY = 'cy-demo-db';
type Db = { applications: Application[]; notifications: AppNotification[]; paid: Record<string, string>; users: { id: string; email: string; name: string; phone: string | null }[] };
const empty = (): Db => ({ applications: [], notifications: [], paid: {}, users: [] });

export function readDb(): Db {
  try {
    return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Db>) };
  } catch {
    return empty();
  }
}
export function writeDb(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function demoCreateApplication(serviceId: string, data: Partial<Application>): Application {
  const svc = demoServices.find((s) => s.id === serviceId)!;
  const now = new Date().toISOString();
  const app: Application = {
    id: uuid(), reference: `${county.slug.slice(0, 3).toUpperCase()}-A${uuid().replace(/-/g, '').slice(0, 10).toUpperCase()}`, service_id: serviceId, ward_id: null, business_name: null, kra_pin: null, form_data: {},
    status: 'draft', amount: svc.fee, decision_note: null, due_at: new Date(Date.now() + svc.sla_working_days * 86_400_000).toISOString(), created_at: now, updated_at: now, ...data,
  };
  const db = readDb();
  db.applications.unshift(app);
  writeDb(db);
  return app;
}

export function demoNotify(n: Omit<AppNotification, 'id' | 'created_at' | 'read'>) {
  const db = readDb();
  db.notifications.unshift({ ...n, id: uuid(), created_at: new Date().toISOString(), read: false });
  writeDb(db);
}
