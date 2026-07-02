"use client";

import { CloudOff, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCountyStore } from "@/lib/store";

export function OfflineQueueBanner() {
  const t = useTranslations("common");
  const queuedActions = useCountyStore((state) => state.queuedActions);
  const simulateSync = useCountyStore((state) => state.simulateSync);
  const pending = queuedActions.filter((action) => action.status !== "synced");

  if (pending.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-charcoal)] px-4 py-3 text-white shadow-2xl"
      role="status"
    >
      <div className="flex items-center gap-3">
        <CloudOff aria-hidden="true" size={22} />
        <div>
          <p className="text-sm font-black">{t("waitingToSync")}</p>
          <p className="text-xs text-white/75">
            {pending.length} action{pending.length === 1 ? "" : "s"} in the offline queue
          </p>
        </div>
      </div>
      <Button className="bg-white text-[var(--color-charcoal)] hover:bg-[var(--color-maize)]" onClick={simulateSync}>
        <RotateCw aria-hidden="true" size={16} />
        {t("syncing")}
      </Button>
    </div>
  );
}
