import { NO_DATA, scales, type Metric } from './palette';

/** Legend that mirrors the map colours. `low`/`high` are the human labels for the ends of the scale. */
export function MapLegend({ metric, low, high, noData }: { metric: Metric; low: string; high: string; noData: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-ink-2" role="group" aria-label={`${low} – ${high}`}>
      <span>{low}</span>
      <span className="flex h-2.5 w-28 overflow-hidden rounded-full ring-1 ring-black/10" aria-hidden>
        {scales[metric].map((c) => (
          <span key={c} className="h-full flex-1" style={{ background: c }} />
        ))}
      </span>
      <span>{high}</span>
      <span className="ml-1 inline-flex items-center gap-1.5 text-muted">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: NO_DATA }} />
        {noData}
      </span>
    </div>
  );
}
