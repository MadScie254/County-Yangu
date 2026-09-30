import { useEffect, useState } from 'react';
import { MessageCircle, Share2, Square, Volume2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from './Button';
import { toast } from './Toast';

/**
 * Share a page on WhatsApp (or the phone's own share sheet) and have it read aloud. Reading aloud uses the phone's
 * built-in voice, in Kiswahili when the page is in Kiswahili; nothing is sent anywhere.
 */
export function ShareListen({ text, speak, className }: { text: string; speak: string; className?: string }) {
  const { t, locale } = useI18n();
  const [talking, setTalking] = useState(false);
  const url = typeof window === 'undefined' ? '' : window.location.href;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, [canSpeak]);

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast({ tone: 'good', title: t('common.copied') });
    } catch { /* cancelled */ }
  };
  const listen = () => {
    if (talking) { window.speechSynthesis.cancel(); setTalking(false); return; }
    const u = new SpeechSynthesisUtterance(speak);
    u.lang = locale === 'sw' ? 'sw-KE' : 'en-KE';
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(locale === 'sw' ? 'sw' : 'en'));
    if (voice) u.voice = voice;
    u.onend = () => setTalking(false);
    u.onerror = () => setTalking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTalking(true);
  };

  return (
    <div className={className ?? 'flex flex-wrap gap-2'}>
      <a className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-bg-2" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noreferrer">
        <MessageCircle className="size-4" aria-hidden />{t('loop.share.whatsapp')}
      </a>
      <Button size="sm" variant="secondary" icon={<Share2 className="size-4" aria-hidden />} onClick={() => void share()}>{t('loop.share.share')}</Button>
      {canSpeak && (
        <Button size="sm" variant={talking ? 'soft' : 'secondary'} aria-pressed={talking} icon={talking ? <Square className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />} onClick={listen}>
          {talking ? t('loop.share.stop') : t('loop.share.listen')}
        </Button>
      )}
    </div>
  );
}
