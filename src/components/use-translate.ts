"use client";

import { useLocale } from "@/components/locale-provider";

/** Returns t(english, spanish), picking the text for the current language. */
export function useTranslate() {
  const { locale } = useLocale();
  return (english: string, spanish: string) => (locale === "es" ? spanish : english);
}
