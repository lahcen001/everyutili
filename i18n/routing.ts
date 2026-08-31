import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "ar",
  "ja",
  "hi",
  "zh-CN",
  "ru",
  "it",
  "id",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const rtlLocales: readonly Locale[] = ["ar"];

export function isRtlLocale(locale: string): boolean {
  return (rtlLocales as readonly string[]).includes(locale);
}

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ar: "العربية",
  ja: "日本語",
  hi: "हिन्दी",
  "zh-CN": "简体中文",
  ru: "Русский",
  it: "Italiano",
  id: "Bahasa Indonesia",
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
