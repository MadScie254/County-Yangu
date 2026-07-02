"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

type LiveEvent = {
  id: string;
  type: "bid" | "delay" | "vote" | "milestone" | "flag";
  emoji: string;
  message: string;
};

const EVENT_POOL: Omit<LiveEvent, "id">[] = [
  {
    type: "bid",
    emoji: "🔥",
    message: "Nabuyole Builders submitted a bid for Chwele Drainage Phase II",
  },
  {
    type: "delay",
    emoji: "⚠️",
    message:
      "Lwandanyi ECDE milestone 'Foundation' marked as delayed — 3 weeks overdue",
  },
  {
    type: "vote",
    emoji: "🗳️",
    message: "48 new citizens voted in Kimilili ward in the last hour",
  },
  {
    type: "milestone",
    emoji: "✅",
    message: "Tongaren Road Tarmac: Milestone 'Base Layers' completed",
  },
  {
    type: "flag",
    emoji: "🚩",
    message:
      "Oversight Alert: Bungoma Technical Supplies flagged for late invoice submission",
  },
  {
    type: "vote",
    emoji: "📊",
    message: "Ward Trust Index updated — Bumula rises 4 points this week",
  },
  {
    type: "bid",
    emoji: "📋",
    message:
      "New tender published: Sirisia Health Centre Equipment Supply — KES 8.4M",
  },
  {
    type: "milestone",
    emoji: "🏗️",
    message: "Kanduyi Market Stalls: Roofing phase 80% complete",
  },
  {
    type: "flag",
    emoji: "🚨",
    message:
      "Anomaly Detected: Elgon Sun Systems holds 2 active tenders — monitoring escalated",
  },
  {
    type: "vote",
    emoji: "👥",
    message: "112 citizens joined County Yangu this week across 7 wards",
  },
];

const typeStyles: Record<
  LiveEvent["type"],
  { border: string; bg: string; Icon: typeof Bell }
> = {
  bid: {
    border: "border-[var(--color-charcoal)]/20",
    bg: "bg-[var(--color-charcoal)]/5",
    Icon: Briefcase,
  },
  delay: {
    border: "border-[var(--color-maize)]",
    bg: "bg-[var(--color-maize)]/10",
    Icon: AlertTriangle,
  },
  vote: {
    border: "border-[var(--color-cane)]/30",
    bg: "bg-[var(--color-cane)]/5",
    Icon: TrendingUp,
  },
  milestone: {
    border: "border-[var(--color-cane)]/40",
    bg: "bg-[var(--color-cane)]/10",
    Icon: CheckCircle2,
  },
  flag: {
    border: "border-[var(--color-bead-red)]/40",
    bg: "bg-[var(--color-bead-red)]/10",
    Icon: AlertTriangle,
  },
};

const INTERVAL_MS = 9000;
const SHOW_MS = 7000;

export function LiveEcosystem() {
  const [toasts, setToasts] = useState<LiveEvent[]>([]);

  useEffect(() => {
    let pool = [...EVENT_POOL];
    let used: Omit<LiveEvent, "id">[] = [];

    const fire = () => {
      if (pool.length === 0) {
        pool = [...used];
        used = [];
      }
      const idx = Math.floor(Math.random() * pool.length);
      const [event] = pool.splice(idx, 1);
      used.push(event);

      const id = crypto.randomUUID();
      const toast: LiveEvent = { ...event, id };

      setToasts((prev) => [toast, ...prev].slice(0, 5));

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, SHOW_MS);
    };

    // First pop after 4 seconds
    const initial = setTimeout(fire, 4000);
    const interval = setInterval(fire, INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div
      aria-live="polite"
      aria-label="Live county updates"
      className="fixed bottom-6 right-4 z-40 flex flex-col-reverse items-end gap-3 sm:right-6"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          const Icon = style.Icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={`flex w-[min(330px,calc(100vw-2rem))] items-start gap-3 rounded-xl border ${style.border} ${style.bg} p-4 shadow-lg backdrop-blur-lg`}
            >
              <span
                className="shrink-0 text-lg leading-none"
                aria-hidden="true"
              >
                {toast.emoji}
              </span>
              <p className="flex-1 text-xs font-semibold leading-relaxed text-[var(--color-charcoal)]">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
