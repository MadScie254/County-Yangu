import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { IconButton } from './Button';

/**
 * A modal built on the native <dialog>: focus is trapped, Escape closes, the page behind is inert,
 * and it works without a JS focus-trap library. Bottom sheet on phones, centred card on desktop.
 */
export function Sheet({ open, onClose, title, children, closeLabel = 'Close', className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; closeLabel?: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      aria-label={title}
      className={cn(
        'fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-lg overflow-visible bg-transparent p-0 text-ink backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]',
        'sm:inset-y-0 sm:my-auto sm:h-fit',
        className,
      )}
    >
      <div className="max-h-[88dvh] overflow-y-auto rounded-t-[1.75rem] border border-line bg-surface p-5 pb-8 shadow-pop sm:rounded-[1.75rem] sm:pb-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-extrabold">{title}</h2>
          <IconButton label={closeLabel} onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" aria-hidden />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
