import en from "@/messages/en.json";
import sw from "@/messages/sw.json";
import type { Locale } from "@/lib/locales";

const messages = { en, sw };

export type Messages = typeof en;

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
