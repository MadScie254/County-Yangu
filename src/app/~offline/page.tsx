import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg)] px-4 py-10 text-[var(--color-charcoal)]">
      <section className="max-w-xl rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-bead-red)]">
          Offline
        </p>
        <h1 className="mt-3 font-display text-5xl">Your action is safe</h1>
        <p className="mt-4 leading-7 text-[var(--color-muted)]">
          County Yangu can keep a vote or report on this device and sync it when signal returns.
          Return to the saved page or open the home page when you are back online.
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[var(--color-charcoal)] px-4 py-2 font-bold text-white" href="/en">
          Open County Yangu
        </Link>
      </section>
    </main>
  );
}
