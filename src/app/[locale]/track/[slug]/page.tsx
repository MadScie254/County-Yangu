import { CheckCircle2, Circle, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ContractorProfileTrigger } from "@/components/tenders/contractor-trigger";
import { getProjectBySlug, getWard, reports, projects, projectStatusLabel } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";
import { formatCurrency } from "@/lib/utils";

export function generateStaticParams() {
  return projects.flatMap((project) => [
    { locale: "en", slug: project.slug },
    { locale: "sw", slug: project.slug },
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const project = getProjectBySlug(slug);
  if (!project) return {};

  return {
    title: project.title,
    description: `${project.title} in ${getWard(project.wardId)?.name}: ${projectStatusLabel(project.status)}.`,
    openGraph: {
      title: project.title,
      description: `${formatCurrency(project.budget, locale as Locale)} · ${projectStatusLabel(project.status)}`,
      images: [`/${locale}/track/${slug}/opengraph-image`],
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const project = getProjectBySlug(slug);
  if (!project) notFound();
  const ward = getWard(project.wardId);
  const linkedReports = reports.filter((report) => project.linkedReportRefs.includes(report.reference));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link className="text-sm font-bold underline" href={`/${locale}/track`}>
        {messages.track.back}
      </Link>
      <section className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.55fr]">
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--color-maize-soft)] px-2 py-1 text-xs font-black">
              {ward?.name}
            </span>
            <span className="rounded bg-[var(--color-bg)] px-2 py-1 text-xs font-black capitalize">
              {projectStatusLabel(project.status)}
            </span>
          </div>
          <h1 className="mt-4 font-display text-5xl leading-none">{project.title}</h1>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.budget}</dt>
              <dd className="font-data text-xl font-black">{formatCurrency(project.budget, locale)}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.spent}</dt>
              <dd className="font-data text-xl font-black">{formatCurrency(project.spent, locale)}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.contractor}</dt>
              <dd className="font-black">
                <ContractorProfileTrigger name={project.contractor} />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.track.expected}</dt>
              <dd className="font-data font-black">{project.expectedAt}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <h2 className="text-xl font-black">{messages.track.milestones}</h2>
            <ol className="mt-4 grid gap-3">
              {project.milestones.map((milestone) => (
                <li className="flex gap-3 rounded-md bg-[var(--color-bg)] p-3" key={milestone.title}>
                  {milestone.complete ? (
                    <CheckCircle2 aria-hidden="true" className="text-[var(--color-cane)]" />
                  ) : (
                    <Circle aria-hidden="true" className="text-[var(--color-muted)]" />
                  )}
                  <div>
                    <p className="font-black">{milestone.title}</p>
                    <p className="font-data text-sm text-[var(--color-muted)]">{milestone.date}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <h2 className="font-black">{messages.track.linkedReports}</h2>
            <div className="mt-4 grid gap-3">
              {linkedReports.length > 0 ? (
                linkedReports.map((report) => (
                  <Link className="rounded-md bg-[var(--color-bg)] p-3 font-data font-black underline" href={`/${locale}/report/${report.reference}`} key={report.reference}>
                    {report.reference}
                  </Link>
                ))
              ) : (
                <p className="text-sm leading-6 text-[var(--color-muted)]">
                  No public report references are linked to this project.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <h2 className="font-black">{messages.track.photos}</h2>
            <div className="mt-4 grid gap-3">
              {project.photos.map((photo, index) => (
                <div className="rounded-md bg-[var(--color-charcoal)] p-4 text-white" key={photo}>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-maize)]">
                    Photo {index + 1}
                  </p>
                  <p className="mt-8 font-black capitalize">{photo}</p>
                </div>
              ))}
            </div>
          </div>
          <ButtonLink href={`https://wa.me/?text=${encodeURIComponent(`Track ${project.title} on County Yangu`)}`} variant="secondary">
            <Share2 aria-hidden="true" size={18} />
            {messages.track.share}
          </ButtonLink>
        </aside>
      </section>
    </div>
  );
}
