import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X, Loader2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { MAX_PHOTOS, preparePhoto } from '@/shared/lib/image';
import { Button } from '@/shared/ui/Button';
import { uuid } from '@/shared/lib/utils';
import { toast } from '@/shared/ui/Toast';

export type Photo = { id: string; blob: Blob; url: string };

/** Camera or gallery. Every photo is resized and stripped of metadata on this device before it is kept. */
export function PhotoPicker({ photos, onChange }: { photos: Photo[]; onChange: (p: Photo[]) => void }) {
  const { t } = useI18n();
  const cam = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(photos);
  useEffect(() => { latest.current = photos; });

  // release object URLs when the picker goes away
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...photos];
      for (const f of Array.from(files)) {
        if (next.length >= MAX_PHOTOS) break;
        const { blob } = await preparePhoto(f);
        next.push({ id: uuid(), blob, url: URL.createObjectURL(blob) });
      }
      onChange(next);
    } catch {
      toast({ tone: 'bad', title: t('errors.generic') });
    } finally {
      setBusy(false);
      if (cam.current) cam.current.value = '';
      if (gallery.current) gallery.current.value = '';
    }
  };

  const remove = (id: string) => {
    const gone = photos.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    onChange(photos.filter((p) => p.id !== id));
  };

  const full = photos.length >= MAX_PHOTOS;
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative size-24 overflow-hidden rounded-2xl border border-line shadow-card">
            <img src={p.url} alt="" className="size-full object-cover" />
            <button type="button" aria-label={t('report.removePhoto')} onClick={() => remove(p.id)} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-ink/80 text-bg hover:bg-ink">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
        {busy && (
          <div className="grid size-24 place-items-center rounded-2xl border border-dashed border-line-strong text-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </div>
        )}
      </div>

      {!full && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Camera className="size-4" aria-hidden />} onClick={() => cam.current?.click()} disabled={busy}>
            {t('report.takePhoto')}
          </Button>
          <Button variant="ghost" size="sm" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => gallery.current?.click()} disabled={busy}>
            {t('report.choosePhoto')}
          </Button>
        </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void add(e.target.files)} />
      <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
      <p className="mt-2 text-[0.82rem] text-muted">{photos.length > 0 ? t('report.photosCount', { count: photos.length }) : t('report.addPhotoHint')}</p>
    </div>
  );
}
