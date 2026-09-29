import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "warning" | "info" | "error";

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

const ICON_MAP = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const COLOR_MAP = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-red-50 border-red-200 text-red-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current.slice(-4), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), 6000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const Icon = ICON_MAP[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border rounded-2xl p-4 shadow-2xl shadow-black/10 ${COLOR_MAP[toast.type]}`}
              role="status"
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  <p className="text-sm mt-1 opacity-90">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="text-current opacity-60 hover:opacity-100 transition p-1"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
