import { useState } from 'react';
import { ImageDown } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import { loadImage, shareCard, type CardSpec } from '@/shared/lib/shareCard';
import { Button } from './Button';
import { toast } from './Toast';

/** One tap: a picture card for WhatsApp. `path` is the page to link to, e.g. `/case/NAI-R...`. */
export function ShareCardButton({ card, text, path, imageUrls, size = 'sm', variant = 'secondary', label }: {
  card: Omit<CardSpec, 'brand' | 'footer' | 'images'>; text: string; path: string; imageUrls?: (string | null)[];
  size?: 'sm' | 'md'; variant?: 'primary' | 'secondary' | 'soft'; label?: string;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const url = `${window.location.origin}${path}`;
  const go = async () => {
    setBusy(true);
    try {
      const images = imageUrls ? await Promise.all(imageUrls.map((u) => (u ? loadImage(u) : Promise.resolve(null)))) : undefined;
      const how = await shareCard({ ...card, images, brand: `County Yangu · ${county.name}`, footer: url.replace(/^https?:\/\//, '') }, text, url);
      if (how === 'downloaded') toast({ tone: 'good', title: t('share.downloaded') });
    } catch {
      toast({ tone: 'bad', title: t('share.failed') });
    } finally {
      setBusy(false);
    }
  };
  return <Button size={size} variant={variant} loading={busy} icon={<ImageDown className="size-4" aria-hidden />} onClick={() => void go()}>{label ?? t('share.card')}</Button>;
}
