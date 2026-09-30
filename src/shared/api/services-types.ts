export type Bilingual = { en: string; sw?: string };

export type FormField = {
  key: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'ward';
  label: Bilingual;
  help?: Bilingual;
  required?: boolean;
  options?: { value: string; label: Bilingual }[];
  pattern?: string;
  max?: number;
};

export type ServiceCategory = 'permit' | 'licence' | 'rates' | 'welfare' | 'planning' | 'health' | 'other';

export type Service = {
  id: string;
  slug: string;
  name: string;
  name_sw: string | null;
  category: ServiceCategory;
  description: string | null;
  fee: number;
  fee_note: string | null;
  requires_kra_pin: boolean;
  form_schema: FormField[];
  required_documents: string[];
  sla_working_days: number;
  status: 'draft' | 'active' | 'suspended';
};

export type ApplicationStatus = 'draft' | 'awaiting_payment' | 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'withdrawn';

export type Application = {
  id: string;
  reference: string;
  service_id: string;
  ward_id: string | null;
  business_name: string | null;
  kra_pin: string | null;
  form_data: Record<string, string>;
  status: ApplicationStatus;
  amount: number;
  decision_note: string | null;
  verify_code?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationDoc = { id: string; application_id: string; kind: string; storage_path: string; created_at: string };

export type PaymentState = { status: 'pending' | 'completed' | 'failed' | 'timeout'; mpesa_receipt: string | null };

export type AppNotification = { id: string; title: string; message: string; kind: 'info' | 'success' | 'warning' | 'error'; link: string | null; read: boolean; created_at: string };

export type SessionUser = { id: string; email: string; name: string; phone: string | null };
