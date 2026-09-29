import { AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ConfigBanner() {
  if (isSupabaseConfigured) {
    return null;
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-3 text-sm text-center font-medium">
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Supabase is not configured. Set <code className="font-mono text-xs bg-amber-600/40 px-1 rounded">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs bg-amber-600/40 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment.
        </span>
      </div>
    </div>
  );
}
