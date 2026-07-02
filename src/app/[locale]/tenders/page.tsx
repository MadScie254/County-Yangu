import { AlertTriangle, Briefcase, Calculator, CheckCircle2, CircleDashed, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/section-header";
import { getWard, tenders } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";
import { formatCurrency, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  return {
    title: messages.tenders.title,
    description: messages.tenders.intro,
  };
}

export default async function TendersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const t = messages.tenders;

  // Calculate high-level metrics
  const activeTendersCount = tenders.length;
  const totalValue = tenders.reduce((sum, t) => sum + t.estimatedBudget, 0);

  // Compute Anomalies
  // Group by contractor to flag companies with > 2 tenders
  const contractorCounts: Record<string, { count: number; value: number }> = {};
  tenders.forEach((tender) => {
    if (tender.contractor) {
      if (!contractorCounts[tender.contractor]) {
        contractorCounts[tender.contractor] = { count: 0, value: 0 };
      }
      contractorCounts[tender.contractor].count += 1;
      contractorCounts[tender.contractor].value += tender.estimatedBudget;
    }
  });

  const flaggedContractors = Object.entries(contractorCounts)
    .filter(([_, data]) => data.count > 2)
    .map(([name, data]) => ({ name, ...data }));

  const statusConfig = {
    open: { label: t.statusOpen, icon: CircleDashed, color: "text-[var(--color-cane)]" },
    evaluating: { label: t.statusEvaluating, icon: Users, color: "text-[var(--color-maize)]" },
    awarded: { label: t.statusAwarded, icon: CheckCircle2, color: "text-white" },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionHeader title={t.title}>{t.intro}</SectionHeader>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/20 bg-white/60 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3 text-[var(--color-muted)]">
            <Briefcase size={20} />
            <h3 className="font-bold">{t.active}</h3>
          </div>
          <p className="mt-2 font-data text-4xl font-black text-[var(--color-charcoal)]">
            {formatNumber(activeTendersCount, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/60 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3 text-[var(--color-muted)]">
            <Calculator size={20} />
            <h3 className="font-bold">{t.value}</h3>
          </div>
          <p className="mt-2 font-data text-4xl font-black text-[var(--color-charcoal)]">
            {formatCurrency(totalValue, locale)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-bead-red)]/30 bg-[var(--color-bead-red)]/10 p-5 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3 text-[var(--color-bead-red)]">
            <AlertTriangle size={20} />
            <h3 className="font-bold">{t.flagged}</h3>
          </div>
          <p className="mt-2 font-data text-4xl font-black text-[var(--color-bead-red)]">
            {flaggedContractors.length}
          </p>
        </div>
      </section>

      {flaggedContractors.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-3 text-[var(--color-bead-red)]">
            <AlertTriangle size={24} />
            <h2 className="font-display text-2xl font-black">{t.anomaliesTitle}</h2>
          </div>
          <p className="mt-1 text-[var(--color-muted)]">{t.anomaliesIntro}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {flaggedContractors.map((contractor) => (
              <div key={contractor.name} className="flex flex-col sm:flex-row justify-between rounded-xl border border-[var(--color-bead-red)]/40 bg-[var(--color-bead-red)]/10 p-5 shadow-md">
                <div>
                  <h4 className="text-lg font-black text-[var(--color-charcoal)]">{contractor.name}</h4>
                  <p className="mt-1 text-sm font-bold text-[var(--color-bead-red)]">
                    FLAG: Awarded {contractor.count} active tenders
                  </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:text-right">
                  <p className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wider">Total Value</p>
                  <p className="font-data text-xl font-black text-[var(--color-bead-red)]">
                    {formatCurrency(contractor.value, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="grid gap-6 lg:grid-cols-2">
          {tenders.map((tender) => {
            const status = statusConfig[tender.status];
            const StatusIcon = status.icon;
            
            return (
              <article key={tender.id} className="flex flex-col justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-sm transition-all hover:shadow-md hover:border-[var(--color-charcoal)]/30">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <span className="rounded-md bg-[var(--color-bg)] px-2 py-1 font-data text-xs font-black uppercase tracking-widest text-[var(--color-muted)]">
                      {tender.reference}
                    </span>
                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tender.status === 'awarded' ? 'bg-[var(--color-charcoal)] text-white' : 'bg-[var(--color-maize-soft)] text-[var(--color-charcoal)]'}`}>
                      <StatusIcon size={14} className={status.color} />
                      {status.label}
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-2xl leading-tight">{tender.title}</h3>
                  <p className="mt-2 text-sm font-bold text-[var(--color-muted)]">
                    {getWard(tender.wardId)?.name} · {tender.sector}
                  </p>
                </div>

                <div className="mt-6 border-t border-[var(--color-line)] pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">Est. Budget</p>
                    <p className="font-data text-lg font-black">{formatCurrency(tender.estimatedBudget, locale)}</p>
                  </div>
                  {tender.contractor ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">Contractor</p>
                      <p className="text-base font-black truncate" title={tender.contractor}>{tender.contractor}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">Applicants</p>
                      <p className="font-data text-lg font-black">{tender.applicantsCount}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
