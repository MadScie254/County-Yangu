import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void;
};
type Ctor = new () => Recognition;

/**
 * Dictation for people who find typing hard. Uses the browser's own speech recognition in Kiswahili (or English),
 * so the audio is handled by the phone's speech service and nothing is uploaded by this app. Only the text is kept,
 * and it goes through the same personal-detail scrubbing as typed reports.
 */
export function VoiceInput({ onText }: { onText: (text: string) => void }) {
  const { t, locale } = useI18n();
  const ctor = typeof window === 'undefined' ? undefined : ((window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: Ctor }).webkitSpeechRecognition);
  const rec = useRef<Recognition | null>(null);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => rec.current?.stop(), []);

  if (!ctor) return <p className="mt-2 text-xs text-muted">{t('loop.voice.unsupported')}</p>;
  const start = () => {
    setFailed(false);
    const r = new ctor();
    r.lang = locale === 'sw' ? 'sw-KE' : 'en-KE';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) if (e.results[i]!.isFinal) text += `${e.results[i]![0]!.transcript} `;
      if (text.trim()) onText(text.trim());
    };
    r.onerror = () => { setFailed(true); setOn(false); };
    r.onend = () => setOn(false);
    rec.current = r;
    r.start();
    setOn(true);
  };
  return (
    <div className="mt-3">
      <Button type="button" size="sm" variant={on ? 'danger' : 'secondary'} icon={on ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />} onClick={() => (on ? rec.current?.stop() : start())}>
        {on ? t('loop.voice.stop') : t('loop.voice.start')}
      </Button>
      <p className="mt-1 text-xs text-muted" role="status">{on ? t('loop.voice.listening') : failed ? t('loop.voice.error') : ''}</p>
    </div>
  );
}
