
import { supabase } from "./supabase";
import type { Application, Department, Petition, ServiceItem } from "./types";

type ApplicationRow = {
  id: string;
  user_id?: string | null;
  applicant: string;
  applicant_id: string;
  applicant_email: string;
  applicant_phone: string;
  service: string;
  date: string;
  status: Application["status"];
  amount: number | string;
  business_name?: string | null;
  ward?: string | null;
  sub_county?: string | null;
  address?: string | null;
  type: Application["type"];
  documents?: Application["documents"] | null;
};

type PetitionRow = Petition & {
  total_needed?: number;
};

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

export function mapApplicationFromRow(row: Partial<ApplicationRow> & Partial<Application>): Application {
  return {
    id: row.id ?? "",
    userId: row.userId ?? row.user_id ?? undefined,
    applicant: row.applicant ?? "",
    applicantId: row.applicantId ?? row.applicant_id ?? "",
    applicantEmail: row.applicantEmail ?? row.applicant_email ?? "",
    applicantPhone: row.applicantPhone ?? row.applicant_phone ?? "",
    service: row.service ?? "",
    date: row.date ?? "",
    status: row.status ?? "Pending Review",
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount ?? 0),
    businessName: row.businessName ?? row.business_name ?? undefined,
    ward: row.ward ?? undefined,
    subCounty: row.subCounty ?? row.sub_county ?? undefined,
    address: row.address ?? undefined,
    type: row.type ?? "citizen",
    documents: row.documents ?? undefined,
  };
}

export function mapApplicationToRow(app: Partial<Application>) {
  return withoutUndefined({
    id: app.id,
    user_id: app.userId,
    applicant: app.applicant,
    applicant_id: app.applicantId,
    applicant_email: app.applicantEmail,
    applicant_phone: app.applicantPhone,
    service: app.service,
    date: app.date,
    status: app.status,
    amount: app.amount,
    business_name: app.businessName,
    ward: app.ward,
    sub_county: app.subCounty,
    address: app.address,
    type: app.type,
    documents: app.documents,
  });
}

export function mapPetitionFromRow(row: PetitionRow): Petition {
  return {
    id: row.id,
    title: row.title,
    deadline: row.deadline,
    supporters: row.supporters,
    totalNeeded: row.totalNeeded ?? row.total_needed ?? 0,
    category: row.category,
  };
}

export async function addApplication(app: Partial<Application>) {
  const newApp: Application = {
    id: app.id ?? `APP-2026-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
    userId: app.userId,
    applicant: app.applicant ?? "Citizen",
    applicantId: app.applicantId ?? "",
    applicantEmail: app.applicantEmail ?? "",
    applicantPhone: app.applicantPhone ?? "",
    service: app.service ?? "County Service",
    date: app.date ?? new Date().toISOString().split("T")[0],
    status: app.status ?? "Pending Review",
    amount: app.amount ?? 0,
    businessName: app.businessName,
    ward: app.ward,
    subCounty: app.subCounty,
    address: app.address,
    type: app.type ?? "citizen",
    documents: app.documents,
  };

  const { data, error } = await supabase
    .from("applications")
    .insert(mapApplicationToRow(newApp))
    .select("*")
    .single();

  if (error) throw error;

  return data ? mapApplicationFromRow(data) : newApp;
}

export async function updateApplicationStatus(id: string, status: Application["status"], applicantUserId?: string) {
  const { error } = await supabase.from("applications").update({ status }).eq("id", id);
  if (error) throw error;

  if (applicantUserId) {
    const notificationType =
      status === "Approved" ? "success" :
      status === "Rejected" ? "error" :
      status === "Changes Requested" ? "warning" :
      "info";

    await createNotification({
      userId: applicantUserId,
      title: `Application ${status}`,
      message: `Your application ${id} has been updated to "${status}".`,
      type: notificationType,
    });
  }
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    date: new Date().toISOString(),
    read: false,
  });

  if (error) throw error;
}

export async function addRevenueEntry(entry: any) {
  const { error } = await supabase.from("revenue").insert({ ...entry, id: `REV-${Date.now()}` });
  if (error) throw error;
}

export async function addDepartment(dept: Partial<Department>) {
  const { error } = await supabase.from("departments").insert(dept);
  if (error) throw error;
}

export async function addService(svc: Partial<ServiceItem>) {
  const { error } = await supabase.from("services").insert(svc);
  if (error) throw error;
}

export async function updateService(id: number, updates: Partial<ServiceItem>) {
  const { error } = await supabase.from("services").update(updates).eq("id", id);
  if (error) throw error;
}

export async function uploadFileToBucket(file: File, bucket: 'avatars' | 'applications-documents', path?: string) {
  const fileName = path || `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: true
  });
  if (error) throw error;
  
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: publicData?.publicUrl };
}

export async function removeService(id: number) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

export async function votePetition(id: number) {
  const { error } = await supabase.rpc('increment_petition_supporters', { petition_id: id });
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function syncProfileCounty(userId: string, countySlug: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ county_slug: countySlug })
    .eq("id", userId);

  if (error) throw error;
}

export async function updateDrugStock(id: number, stock: string, level: string) {
  const { error } = await supabase.from('health_drugs').update({ stock, level }).eq('id', id);
  if (error) throw error;
}

