export type Dept = { id: string; code: string; name: string };

export type Category = {
  id: string;
  name: string;
  department_id: string | null;
  ack_value: number;
  ack_unit: 'hours' | 'working_days';
  resolve_value: number;
  resolve_unit: 'hours' | 'working_days';
  default_priority: 'low' | 'normal' | 'high' | 'urgent';
  sensitive: boolean;
  active: boolean;
};

export type StaffMember = { user_id: string; name: string; role: string; department_id: string | null; sub_county_id: string | null; ward_id: string | null };

export type CaseStatus = 'received' | 'triaged' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected';
export const openStatuses: CaseStatus[] = ['received', 'triaged', 'assigned', 'in_progress'];

export type CaseRow = {
  id: string;
  reference: string;
  ward_id: string;
  category_id: string | null;
  department_id: string | null;
  description: string;
  status: CaseStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: string;
  assigned_to: string | null;
  flagged_financial: boolean;
  ack_due_at: string | null;
  resolve_due_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  escalation_level: number;
  supporters?: number;
  created_at: string;
  updated_at: string;
  lat: number | null;
  lng: number | null;
  project_id: string | null;
};

export type CaseEvent = { id: string; kind: string; actor_id: string | null; is_public: boolean; message: string | null; data: Record<string, unknown>; created_at: string };

export type ReviewApp = {
  id: string;
  reference: string;
  service_id: string;
  service_name: string;
  applicant_name: string;
  applicant_phone: string | null;
  business_name: string | null;
  kra_pin: string | null;
  ward_id: string | null;
  status: string;
  amount: number;
  form_data: Record<string, string>;
  decision_note: string | null;
  due_at: string | null;
  created_at: string;
};

export type OverdueRow = { reference: string; ward: string; category: string; department: string; days_overdue: number; escalation_level: number; flagged_financial: boolean; officer: string | null; created_at: string };

export type RoleGrant = { id: string; user_id: string; role: string; department_id: string | null; sub_county_id: string | null; ward_id: string | null; active: boolean; expires_at: string | null; name?: string; email?: string };

export type RoutingRule = { id: string; category_id: string; ward_id: string | null; department_id: string; officer_id: string | null };

export type AuditRow = { id: number; at: string; actor_id: string | null; via: string | null; action: string; entity: string; entity_id: string | null };
