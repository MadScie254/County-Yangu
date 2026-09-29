// County Connect — Shared Types

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
  national_id?: string;
  role: "citizen" | "admin" | "business" | "super_admin";
  avatar_url?: string;
  address?: string;
  county_slug?: string;
}

// ─── Types ───────────────────────────────────────────────────────────
export interface Application {
  id: string;
  userId?: string;
  applicant: string;
  applicantId: string;
  applicantEmail: string;
  applicantPhone: string;
  service: string;
  date: string;
  status: "Pending Payment" | "Pending Review" | "Approved" | "Rejected" | "Changes Requested";
  amount: number;
  businessName?: string;
  ward?: string;
  subCounty?: string;
  address?: string;
  type: "citizen" | "business";
  county_slug?: string;
  documents?: {
    businessCert?: string;
    kraPinCert?: string;
    identityCard?: string;
  };
}

export interface Tender {
  id: string;
  title: string;
  entity: string;
  value: number;
  status: "Open" | "Evaluated" | "Awarded" | "Cancelled";
  deadline: string;
  awardedTo?: string;
  county_slug?: string;
}

export interface Department {
  id: number;
  name: string;
  head: string;
  staff: number;
  services: number;
}

export interface ServiceItem {
  id: number;
  name: string;
  department: string;
  fee: string;
  status: "Active" | "Draft" | "Suspended";
}

export interface Notification {
  id: number;
  user_id?: string | null;
  title: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
  date: string;
  read: boolean;
}

export interface RevenueEntry {
  id: string;
  ref: string;
  amount: number;
  payer_name: string;
  stream: string;
  created_at: string;
  reconciled: boolean;
  county_slug?: string;
}

export interface HealthDrugItem {
  id: number;
  name: string;
  facility: string;
  stock: string;
  level: "critical" | "low" | "high";
  county_slug?: string;
}

export interface WelfareProgram {
  id: number;
  name: string;
  status: "Enrolled" | "Waitlist" | "Active" | "Inactive";
  date: string;
  method: string;
  county_slug?: string;
}

export interface Petition {
  id: number;
  title: string;
  deadline: string;
  supporters: number;
  totalNeeded: number;
  category: string;
}

export interface LandRecord {
  id: string;
  action: string;
  detail: string;
  status: string;
  hash: string;
  timestamp: string;
}

export interface AnomalyAlert {
  id: number;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  timestamp: string;
  dismissed: boolean;
}
