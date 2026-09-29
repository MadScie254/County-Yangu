
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SupabaseFilter = {
  column: string;
  operator: "eq" | "is";
  value: string | boolean | null;
};

export function useSupabase<T>(
  tableName: string,
  queryOpts?: {
    order?: string;
    ascending?: boolean;
    filters?: SupabaseFilter[];
    enabled?: boolean;
  },
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const enabled = queryOpts?.enabled ?? true;
  const filterKey = JSON.stringify(queryOpts?.filters ?? []);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        let query = supabase.from(tableName).select("*");

        for (const filter of queryOpts?.filters ?? []) {
          if (filter.operator === "eq") {
            query = query.eq(filter.column, filter.value as string);
          } else {
            query = query.is(filter.column, filter.value);
          }
        }

        if (queryOpts?.order) {
          query = query.order(queryOpts.order, { ascending: queryOpts.ascending ?? false });
        }

        const { data: result, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (isMounted && result) {
          setData(result as unknown as T[]);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const nextError = err instanceof Error ? err : new Error("Failed to fetch data");
          setError(nextError);
          console.error(`Error fetching ${tableName}:`, nextError.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    const channel = supabase
      .channel(`public:${tableName}:${filterKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: tableName }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [tableName, queryOpts?.order, queryOpts?.ascending, enabled, filterKey]);

  return { data, loading, error };
}
