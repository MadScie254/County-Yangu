import { useSupabase } from "@/hooks/useSupabase";
import { useMemo } from "react";
import type { 
  Application, Tender, RevenueEntry, AnomalyAlert, LandRecord, 
  Petition, WelfareProgram, HealthDrugItem, Notification, 
  Department, ServiceItem
} from "./types";
import { mapApplicationFromRow, mapPetitionFromRow } from "./mutations";

export * from "./types";
export * from "./mutations";

export function useApplications() {
  const result = useSupabase<Record<string, unknown>>("applications", { order: "date", ascending: false });
  const data = useMemo(() => result.data.map(mapApplicationFromRow), [result.data]);

  return { ...result, data };
}

export function useMyApplications(userId?: string) {
  const result = useSupabase<Record<string, unknown>>("applications", {
    order: "date",
    ascending: false,
    filters: userId ? [{ column: "user_id", operator: "eq", value: userId }] : undefined,
    enabled: Boolean(userId),
  });
  const data = useMemo(() => result.data.map(mapApplicationFromRow), [result.data]);

  return { ...result, data };
}

export function useApplicationById(id: string) {
  const result = useSupabase<Record<string, unknown>>("applications", {
    filters: id ? [{ column: "id", operator: "eq", value: id }] : undefined,
    enabled: Boolean(id),
  });
  const data = useMemo(() => {
    if (!result.data || result.data.length === 0) return null;
    return mapApplicationFromRow(result.data[0]);
  }, [result.data]);

  return { ...result, data };
}

export function useTenders() { return useSupabase<Tender>("tenders"); }
export function useRevenueEntries() { return useSupabase<RevenueEntry>("revenue"); }
export function useAnomalies() { return useSupabase<AnomalyAlert>("anomalies"); }
export function useLandRecords() { return useSupabase<LandRecord>("land_records"); }
export function usePetitions() {
  const result = useSupabase<Petition & { total_needed?: number }>("petitions");
  const data = useMemo(() => result.data.map(mapPetitionFromRow), [result.data]);

  return { ...result, data };
}
export function useWelfarePrograms() { return useSupabase<WelfareProgram>("welfare"); }
export function useHealthDrugs() { return useSupabase<HealthDrugItem>("health_drugs"); }
export function useNotifications() { return useSupabase<Notification>("notifications"); }

export function useMyNotifications(userId?: string) {
  return useSupabase<Notification>("notifications", {
    order: "date",
    ascending: false,
    filters: userId ? [{ column: "user_id", operator: "eq", value: userId }] : undefined,
    enabled: Boolean(userId),
  });
}

export function useDepartments() { return useSupabase<Department>("departments"); }
export function useServices() { return useSupabase<ServiceItem>("services"); }

export function useUnreadCount(userId?: string) {
  const { data } = useMyNotifications(userId);
  return data.filter((notification) => !notification.read).length;
}
