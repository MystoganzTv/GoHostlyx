"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  localeCookieName,
  localeStorageKey,
  normalizeLocale,
  type AppLocale,
} from "@/lib/i18n";

type LocaleContextValue = {
  locale: AppLocale;
  isSpanish: boolean;
  setLocale: (nextLocale: AppLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(nextLocale: AppLocale) {
  document.documentElement.lang = nextLocale;
  window.localStorage.setItem(localeStorageKey, nextLocale);
  document.cookie = localeCookieName + "=" + nextLocale + "; path=/; max-age=31536000; samesite=lax";
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      isSpanish: locale === "es",
      setLocale(nextLocale) {
        const normalized = normalizeLocale(nextLocale);

        if (normalized === locale) {
          return;
        }

        persistLocale(normalized);
        setLocaleState(normalized);
        startTransition(() => {
          router.refresh();
        });
      },
    }),
    [locale, router],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider.");
  }

  return context;
}

