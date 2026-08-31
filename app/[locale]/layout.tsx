import type { Metadata } from "next";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import {
  Geist,
  Geist_Mono,
  Noto_Sans,
  Noto_Sans_Arabic,
  Noto_Sans_JP,
  Noto_Sans_Devanagari,
  Noto_Sans_SC,
} from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";

import { routing, isRtlLocale, type Locale } from "@/i18n/routing";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AmbientBackground } from "@/components/ui/AmbientBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Script-specific web fonts for locales Geist doesn't cover, each scoped to
 * only the Unicode subset it needs to keep bundle size down. Selected at
 * render time by locale (see `SCRIPT_FONT_VARIABLES` below) instead of
 * relying on system fonts, which render inconsistently — or as tofu — across
 * OSes that lack the matching font preinstalled.
 */
const notoSansCyrillic = Noto_Sans({
  variable: "--font-noto-cyrillic",
  subsets: ["cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SCRIPT_FONTS = [notoSansCyrillic, notoSansArabic, notoSansJP, notoSansDevanagari, notoSansSC];

/** Which script-font CSS variable `--font-sans` should resolve to per locale. */
const SCRIPT_FONT_VARIABLES: Partial<Record<Locale, string>> = {
  ru: "--font-noto-cyrillic",
  ar: "--font-noto-arabic",
  ja: "--font-noto-jp",
  hi: "--font-noto-devanagari",
  "zh-CN": "--font-noto-sc",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};

  const t = await getTranslations({ locale, namespace: "site" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("metaTitleDefault"),
      template: t("metaTitleTemplate"),
    },
    description: t("metaDescription"),
    applicationName: "EveryUtili",
    keywords: ["online tools", "file converter", "pdf tools", "developer tools", "calculators"],
    openGraph: {
      type: "website",
      siteName: "EveryUtili",
      url: `${SITE_URL}/${locale}`,
      locale,
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale.
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "site" });
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const scriptFontVariable = SCRIPT_FONT_VARIABLES[locale as Locale];

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "EveryUtili",
    url: SITE_URL,
    description: t("organizationDescription"),
  };

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${SCRIPT_FONTS.map((f) => f.variable).join(" ")} h-full antialiased`}
      style={scriptFontVariable ? ({ "--font-sans-active": `var(${scriptFontVariable})` } as CSSProperties) : undefined}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <AmbientBackground />
        <NextIntlClientProvider>
          <ThemeProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export type { Locale };
