import type { Metadata } from "next";
import { ExternalLink, Globe, Puzzle, Search, ShieldCheck, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";
const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/plidfaahplllkmlhnnnbmkokkocfcgpc";

export const metadata: Metadata = {
  title: "Chrome Extension — EveryUtili",
  description:
    "Replace Chrome's New Tab with instant access to 79+ free, privacy-first tools. Get the EveryUtili extension from the Chrome Web Store.",
  alternates: {
    canonical: `${SITE_URL}/en/extension`,
  },
};

const FEATURES = [
  {
    icon: Search,
    title: "Instant tool search",
    body: "Every new tab opens straight into a searchable grid of all 79+ tools — no bookmarks needed.",
  },
  {
    icon: Sparkles,
    title: "Remembers your favorites",
    body: "Recently used tools surface first, so the tools you reach for most are always one click away.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "The extension only stores your recent tool list locally in Chrome — nothing is tracked or sent anywhere.",
  },
];

export default function ExtensionPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Puzzle className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          EveryUtili for Chrome
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          Replace your New Tab page with instant access to every tool. Search, click, done —
          no more digging through bookmarks or typing the URL every time.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
              <Puzzle className="h-4 w-4" />
              Add to Chrome — Free
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            Works on Chrome, Edge, Brave &amp; other Chromium browsers
          </span>
        </div>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="p-5">
            <feature.icon className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">{feature.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </Card>
        ))}
      </div>

      <p className="mt-16 text-center text-xs text-muted-foreground">
        The extension only stores your recent/pinned tools locally in Chrome — see the{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
