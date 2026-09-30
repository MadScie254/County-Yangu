import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

/** The code on an approved permit, as text and as a QR that opens the public check page. Works offline once loaded. */
export function PermitQr({ code }: { code: string }) {
  const { t } = useI18n();
  const [src, setSrc] = useState<string | null>(null);
  const url = `${window.location.origin}/verify/${code}`;
  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((d) => { if (live) setSrc(d); }).catch(() => undefined);
    return () => { live = false; };
  }, [url]);
  return (
    <section className="mt-6 flex flex-col items-center gap-4 rounded-[1.5rem] border border-good bg-good-soft p-5 text-center sm:flex-row sm:text-left" aria-label={t('loop.qr.title')}>
      {src ? <img src={src} alt={code} width={144} height={144} className="rounded-xl bg-white p-2" /> : <div className="size-36 animate-pulse rounded-xl bg-bg-2" />}
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-good">{t('loop.qr.title')}</p>
        <p className="mt-1 font-data text-2xl font-medium tracking-wider">{code}</p>
        <p className="mt-1 text-sm text-ink-2">{t('loop.qr.hint')}</p>
        <Button className="mt-3 print:hidden" size="sm" variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>{t('loop.qr.print')}</Button>
      </div>
    </section>
  );
}
