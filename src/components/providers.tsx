"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SerwistProvider } from "@serwist/turbopack/react";
import { useEffect, useState } from "react";
import { useCountyStore } from "@/lib/store";

function PreferenceBridge() {
  const highContrast = useCountyStore((state) => state.highContrast);
  const simpleMode = useCountyStore((state) => state.simpleMode);
  const textScale = useCountyStore((state) => state.textScale);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
    document.documentElement.dataset.mode = simpleMode ? "simple" : "standard";
    document.documentElement.style.setProperty("--text-scale", String(textScale));
  }, [highContrast, simpleMode, textScale]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
      <QueryClientProvider client={queryClient}>
        <PreferenceBridge />
        {children}
      </QueryClientProvider>
    </SerwistProvider>
  );
}
