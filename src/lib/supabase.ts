import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    "CountyConnect: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Auth and data features will not work until these are set.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
);
