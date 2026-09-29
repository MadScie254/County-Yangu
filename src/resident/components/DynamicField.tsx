import { useI18n } from '@/shared/i18n';
import { wardsBySubCounty } from '@/shared/config/county';
import type { FormField } from '@/shared/api/services-types';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';

/** Renders one field from a service's form_schema, in the resident's language. */
export function DynamicField({ field, value, onChange, error }: { field: FormField; value: string; onChange: (v: string) => void; error?: string | undefined }) {
  const { locale, t } = useI18n();
  const pick = (b?: { en: string; sw?: string }) => (b ? (locale === 'sw' && b.sw ? b.sw : b.en) : undefined);
  const label = pick(field.label) ?? field.key;
  const optional = field.required ? undefined : t('common.optional');
  return (
    <Field label={label} hint={pick(field.help)} error={error} optionalLabel={optional}>
      {({ id, describedBy }) => {
        const common = { id, 'aria-describedby': describedBy, invalid: Boolean(error) };
        switch (field.type) {
          case 'textarea':
            return <TextArea {...common} maxLength={field.max ?? 1000} value={value} onChange={(e) => onChange(e.target.value)} />;
          case 'select':
            return (
              <SelectInput {...common} value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">–</option>
                {field.options?.map((o) => <option key={o.value} value={o.value}>{pick(o.label)}</option>)}
              </SelectInput>
            );
          case 'ward':
            return (
              <SelectInput {...common} value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">{t('report.wardPick')}</option>
                {wardsBySubCounty().map((g) => <optgroup key={g.subCounty.id} label={g.subCounty.name}>{g.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</optgroup>)}
              </SelectInput>
            );
          case 'number':
            return <TextInput {...common} type="number" inputMode="numeric" min={0} max={field.max} value={value} onChange={(e) => onChange(e.target.value)} />;
          case 'date':
            return <TextInput {...common} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
          default:
            return <TextInput {...common} value={value} onChange={(e) => onChange(e.target.value)} />;
        }
      }}
    </Field>
  );
}
