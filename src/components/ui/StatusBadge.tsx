import { CheckCircle2, Clock, XCircle, FileText, FileClock, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApplicationStatus = "Pending Payment" | "Pending Review" | "Approved" | "Rejected" | "Changes Requested";

interface StatusBadgeProps {
  status: ApplicationStatus | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<string, { icon: LucideIcon, colors: string }> = {
  "Approved": { icon: CheckCircle2, colors: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  "Pending Review": { icon: Clock, colors: "text-blue-700 bg-blue-50 border-blue-200" },
  "Pending Payment": { icon: FileClock, colors: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  "Rejected": { icon: XCircle, colors: "text-red-700 bg-red-50 border-red-200" },
  "Changes Requested": { icon: FileText, colors: "text-orange-700 bg-orange-50 border-orange-200" },
};

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || { icon: FileText, colors: "text-gray-700 bg-gray-50 border-gray-200" };
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-1.5"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4"
  };

  return (
    <span className={cn("inline-flex items-center rounded-full font-semibold border", config.colors, sizeClasses[size], className)}>
      <Icon className={iconSizes[size]} />
      {status}
    </span>
  );
}
