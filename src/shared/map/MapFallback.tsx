import type { ReactNode } from 'react';

/** Shown when the device cannot run WebGL. The ward/sub-county lists next to the map still work. */
export function MapFallback({ aria, children }: { aria: string; children?: ReactNode }) {
  return (
    <div role="img" aria-label={aria} className="absolute inset-0 grid place-items-center bg-bg-2 p-6 text-center">
      <div className="max-w-xs text-sm text-muted">{children ?? 'The map cannot be shown on this device. Use the list instead.'}</div>
    </div>
  );
}
