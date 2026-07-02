"use client";

import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, CheckCircle2, Clock, X } from "lucide-react";
import { Contractor } from "@/lib/data";
import { useEffect } from "react";

export function ContractorModal({
  contractor,
  isOpen,
  onClose,
}: {
  contractor: Contractor | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!contractor) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-[var(--color-surface)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] p-5">
              <h2 className="font-display text-xl font-black text-[var(--color-charcoal)]">
                Contractor Intelligence
              </h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-[var(--color-line)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <h3 className="text-2xl font-black">{contractor.name}</h3>
              
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] shadow-inner">
                  <span className={`text-2xl font-black ${contractor.reliabilityScore > 80 ? 'text-[var(--color-cane)]' : contractor.reliabilityScore > 50 ? 'text-[var(--color-maize)]' : 'text-[var(--color-bead-red)]'}`}>
                    {contractor.reliabilityScore}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">Reliability Score</p>
                  <p className="text-sm font-medium mt-1">Based on historical delivery metrics and active flags.</p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-[var(--color-line)] bg-white/50 p-3">
                  <CheckCircle2 className="mx-auto mb-2 text-[var(--color-cane)]" size={24} />
                  <p className="font-data text-2xl font-black">{contractor.projectsCompleted}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-[var(--color-muted)]">On Time</p>
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-white/50 p-3">
                  <Clock className="mx-auto mb-2 text-[var(--color-maize)]" size={24} />
                  <p className="font-data text-2xl font-black">{contractor.projectsLate}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-[var(--color-muted)]">Late</p>
                </div>
                <div className="rounded-xl border border-[var(--color-bead-red)]/30 bg-[var(--color-bead-red)]/5 p-3">
                  <AlertTriangle className="mx-auto mb-2 text-[var(--color-bead-red)]" size={24} />
                  <p className="font-data text-2xl font-black text-[var(--color-bead-red)]">{contractor.projectsStalled}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase text-[var(--color-muted)]">Stalled</p>
                </div>
              </div>

              {contractor.flags.length > 0 && (
                <div className="mt-8 rounded-xl border border-[var(--color-bead-red)] bg-[var(--color-bead-red)]/10 p-4">
                  <h4 className="flex items-center gap-2 font-bold text-[var(--color-bead-red)]">
                    <AlertTriangle size={16} /> Active Oversight Flags
                  </h4>
                  <ul className="mt-2 list-inside list-disc text-sm font-medium text-[var(--color-charcoal)]">
                    {contractor.flags.map((flag, idx) => (
                      <li key={idx} className="mt-1">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
