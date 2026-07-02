"use client";

import { useState } from "react";
import { getContractor } from "@/lib/data";
import { ContractorModal } from "@/components/ui/contractor-modal";

export function ContractorProfileTrigger({ name }: { name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  // Re-fetch contractor in client
  const contractor = getContractor(name) || null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-base font-black truncate text-left hover:text-[var(--color-cane)] transition-colors hover:underline decoration-2 underline-offset-4"
        title="View Contractor Intelligence"
      >
        {name}
      </button>
      <ContractorModal 
        contractor={contractor} 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}
