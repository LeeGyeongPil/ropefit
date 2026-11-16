// UI language: query ?lang= (for screenshots) > localStorage "ropefit.lang" > navigator.language (first run only).
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import en from "./en.json";
import ko from "./ko.json";

export type Lang = "en" | "ko";
export const LANGS: Lang[] = ["en", "ko"];
export const LANG_STORAGE_KEY = "ropefit.lang";

export const MESSAGES: Record<Lang, Record<string, string>> = { en, ko };

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "ko";
}

export function detectInitialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (isLang(q)) return q;
  } catch { /* no window.location: ignore */ }
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch { /* storage blocked: fall through */ }
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  const detected: Lang = nav.toLowerCase().startsWith("ko") ? "ko" : "en";
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, detected);
  } catch { /* ignore */ }
  return detected;
}

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const text = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch { /* ignore */ }
    document.documentElement.lang = l;
  }, []);
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: (k, p) => translate(lang, k, p) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
