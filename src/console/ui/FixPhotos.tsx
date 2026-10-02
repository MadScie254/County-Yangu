import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import { fixPhotoUrl, getFixPhotos, uploadFixPhoto } from '@/shared/api/civic2';
import { preparePhoto } from '@/shared/lib/image';
import { SelectInput, TextInput } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';
import { Panel } from './Page';

/** Before and after photos. They appear on the public case page and in the Fixed gallery; an after photo is needed to resolve. */
export function FixPhotos({ reportId, needsAfter, canUpload }: { reportId: string; needsAfter: boolean; canUpload: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fix-photos', reportId], queryFn: () => getFixPhotos(reportId) });
  const [kind, setKind] = useState<'before' | 'after'>('after');
  const [caption, setCaption] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const up = useMutation({
    mutationFn: async (file: File) => uploadFixPhoto(reportId, kind, (await preparePhoto(file)).blob, caption.trim() || null),
    onSuccess: () => { setAdded((a) => [...a, kind]); setCaption(''); toast({ tone: 'good', title: `${kind === 'after' ? 'After' : 'Before'} photo added.` }); void qc.invalidateQueries({ queryKey: ['fix-photos', reportId] }); },
    onError: (e) => toast({ tone: 'bad', title: 'The photo was not added', body: e instanceof Error ? e.message : 'You can add photos only to cases you work on.' }),
  });
  const list = q.data ?? [];
  const hasAfter = list.some((p) => p.kind === 'after') || added.includes('after');
  return (
    <Panel title="Before and after">
      {list.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-2">
          {list.map((p) => (
            <li key={p.id} className="relative">
              <img src={fixPhotoUrl(p.path)} alt={`${p.kind} photo${p.caption ? `: ${p.caption}` : ''}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-bold uppercase text-bg">{p.kind}</span>
            </li>
          ))}
        </ul>
      )}
      {needsAfter && !hasAfter && <p className="mb-3 rounded-xl bg-warn-soft p-3 text-sm font-semibold">Add an after photo before marking this fixed. Residents see the before and after side by side.</p>}
      {canUpload ? (
        <div className="grid gap-2">
          <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
            <SelectInput aria-label="Photo of" value={kind} onChange={(e) => setKind(e.target.value as 'before' | 'after')}><option value="after">After</option><option value="before">Before</option></SelectInput>
            <TextInput aria-label="Caption" placeholder="Caption (optional)" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line-strong px-4 py-2.5 text-sm font-semibold hover:bg-bg-2">
            <Camera className="size-4" aria-hidden />{up.isPending ? 'Uploading...' : 'Take or choose a photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={up.isPending} onChange={(e) => { const f = e.target.files?.[0]; if (f) up.mutate(f); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-muted">No faces or number plates, please. Photos are public.</p>
        </div>
      ) : list.length === 0 && <p className="text-sm text-muted">No photos yet.</p>}
    </Panel>
  );
}
