import { Minus, Plus } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { usePrefs, type ThemePref } from '@/shared/state/prefs';
import { Sheet } from '@/shared/ui/Sheet';
import { Segmented } from '@/shared/ui/Field';
import { Button, IconButton } from '@/shared/ui/Button';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[0.95rem] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0" />
        <span aria-hidden className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-good peer-focus-visible:ring-4 peer-focus-visible:ring-info/40" />
        <span aria-hidden className="absolute left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function DisplaySettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const p = usePrefs();
  return (
    <Sheet open={open} onClose={onClose} title={t('a11y.settings')} closeLabel={t('common.close')}>
      <div className="divide-y divide-line">
        <div className="pb-4">
          <p className="mb-2 text-sm font-semibold">{t('a11y.theme')}</p>
          <Segmented<ThemePref>
            label={t('a11y.theme')}
            value={p.theme}
            onChange={p.setTheme}
            options={[
              { value: 'system', label: t('a11y.themeSystem') },
              { value: 'light', label: t('a11y.themeLight') },
              { value: 'dark', label: t('a11y.themeDark') },
            ]}
          />
        </div>
        <div className="py-4">
          <p className="mb-2 text-sm font-semibold">{t('a11y.textSize')}</p>
          <div className="flex items-center gap-3">
            <IconButton label="−" onClick={() => p.setTextScale(p.textScale - 0.1)} className="border border-line-strong">
              <Minus className="size-4" aria-hidden />
            </IconButton>
            <div className="flex-1 text-center font-data text-sm" aria-live="polite">
              {Math.round(p.textScale * 100)}%
            </div>
            <IconButton label="+" onClick={() => p.setTextScale(p.textScale + 0.1)} className="border border-line-strong">
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </div>
        </div>
        <Toggle checked={p.highContrast} onChange={p.setHighContrast} label={t('a11y.contrast')} />
        <Toggle checked={p.simpleMode} onChange={p.setSimpleMode} label={t('a11y.simpleMode')} hint={t('a11y.simpleModeHint')} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() => {
          p.setTheme('system');
          p.setHighContrast(false);
          p.setSimpleMode(false);
          p.setTextScale(1);
        }}
      >
        {t('a11y.reset')}
      </Button>
    </Sheet>
  );
}
