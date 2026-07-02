import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: getMessages(locale),
  };
});
