import type { Metadata } from "next";
import { Download, Globe, Puzzle, Search, ShieldCheck, Sparkles } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

export const metadata: Metadata = {
  title: "Chrome Extension — EveryUtili",
  description:
    "Replace Chrome's New Tab with instant access to 79+ free, privacy-first tools. Download the EveryUtili extension and load it in seconds.",
  alternates: {
    canonical: `${SITE_URL}/en/extension`,
  },
};

const STEPS = [
  {
    title: "Download the extension",
    body: "Click the button above to download everyutili-extension.zip, then unzip it anywhere on your computer.",
  },
  {
    title: "Open chrome://extensions",
    body: "Type chrome://extensions into your address bar and press Enter, or find it under Chrome's menu → More Tools → Extensions.",
  },
  {
    title: "Turn on Developer mode",
    body: "Flip the “Developer mode” switch in the top-right corner of the extensions page.",
  },
  {
    title: "Load unpacked",
    body: "Click “Load unpacked” and select the unzipped everyutili-extension folder. That's it — your New Tab is now EveryUtili.",
  },
];

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
            <a href="/downloads/everyutili-extension.zip" download>
              <Download className="h-4 w-4" />
              Download for Chrome
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

      <div className="mt-16">
        <h2 className="text-xl font-bold tracking-tight">How to install</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Not on the Chrome Web Store yet — install it directly in under a minute.
        </p>

        <ol className="mt-6 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        The extension only stores your recent/pinned tools locally in Chrome — see the{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
