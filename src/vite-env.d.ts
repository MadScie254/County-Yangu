/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_COUNTY?: string;
  readonly VITE_COUNTY_DOMAIN?: string;
  readonly VITE_USSD_CODE?: string;
  readonly VITE_SMS_SHORTCODE?: string;
  readonly VITE_PAYBILL?: string;
  /** "1" forces sample data even when a backend is configured (design work, demos). */
  readonly VITE_FORCE_DEMO?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
