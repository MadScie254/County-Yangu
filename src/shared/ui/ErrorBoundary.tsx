import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from './Button';

function Fallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-extrabold">{t('common.crashTitle')}</h1>
      <p className="mt-3 text-ink-2">{t('common.crashBody')}</p>
      <Button className="mt-8" icon={<RotateCcw className="size-4" aria-hidden />} onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
}

/**
 * One broken page must never blank the whole site: the header, footer and navigation stay, and the page shows a way
 * back. `resetKey` (the path) clears the error when the person navigates elsewhere.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean; key?: string }> {
  state: { failed: boolean; key?: string } = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { failed: boolean; key?: string }) {
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  componentDidCatch(error: unknown) { console.error('[page]', error); }
  render() {
    return this.state.failed ? <Fallback onRetry={() => window.location.reload()} /> : this.props.children;
  }
}
