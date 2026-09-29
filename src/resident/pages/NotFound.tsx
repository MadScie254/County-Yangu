import { ButtonLink } from '@/shared/ui/Button';
import { useI18n } from '@/shared/i18n';
import { usePageTitle } from '@/shared/lib/hooks';

export default function NotFound() {
  const { t } = useI18n();
  usePageTitle(t('errors.notFoundTitle'));
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-brand">404</p>
      <h1 className="mt-4 font-display text-3xl font-extrabold">{t('errors.notFoundTitle')}</h1>
      <p className="mt-3 text-ink-2">{t('errors.notFoundBody')}</p>
      <ButtonLink to="/" className="mt-8">
        {t('errors.goHome')}
      </ButtonLink>
    </div>
  );
}
