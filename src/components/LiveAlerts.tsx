import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

interface LiveAlert {
  id: number;
  title: string;
  message: string;
  type: "success" | "warning" | "info" | "error";
  timestamp: string;
}

const ICON_MAP = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const COLOR_MAP = {
  success: {
    bg: "bg-emerald-50 border-emerald-200",
    icon: "text-emerald-600",
    title: "text-emerald-900",
    body: "text-emerald-700",
    bar: "bg-emerald-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: "text-blue-600",
    title: "text-blue-900",
    body: "text-blue-700",
    bar: "bg-blue-500",
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    title: "text-amber-900",
    body: "text-amber-700",
    bar: "bg-amber-500",
  },
  error: {
    bg: "bg-red-50 border-red-200",
    icon: "text-red-600",
    title: "text-red-900",
    body: "text-red-700",
    bar: "bg-red-500",
  },
};

export function LiveAlerts() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  const dismiss = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotification = payload.new as any;
          const alert: LiveAlert = {
            id: newNotification.id,
            title: newNotification.title,
            message: newNotification.message,
            type: newNotification.type || "info",
            timestamp: newNotification.date || new Date().toISOString(),
          };
          setAlerts((prev) => [...prev.slice(-4), alert]); // keep max 5

          // Auto-dismiss after 8 seconds
          setTimeout(() => {
            dismiss(alert.id);
          }, 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dismiss]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {alerts.map((alert) => {
        const Icon = ICON_MAP[alert.type] || Info;
        const colors = COLOR_MAP[alert.type] || COLOR_MAP.info;

        return (
          <div
            key={alert.id}
            className={`pointer-events-auto ${colors.bg} border rounded-2xl p-4 shadow-2xl shadow-black/10 animate-slide-in-right relative overflow-hidden`}
          >
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 h-0.5 w-full">
              <div className={`${colors.bar} h-full animate-shrink-bar`} />
            </div>

            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold uppercase tracking-wider ${colors.title}`}>
                  {alert.title}
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${colors.body}`}>
                  {alert.message}
                </p>
                <p className="text-[10px] text-gray-400 mt-1.5 font-mono">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition p-1"
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
