import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://everyutili.com";

export const metadata: Metadata = {
  title: "Privacy Policy — EveryUtili",
  description:
    "How EveryUtili and the EveryUtili Chrome extension handle your data — in short, they don't collect it.",
  alternates: {
    canonical: `${SITE_URL}/en/privacy`,
  },
};

const SECTIONS = [
  {
    title: "The website",
    body: "Every tool on everyutili.com runs entirely in your browser. Files you convert, edit, or generate never leave your device — nothing is uploaded to a server, because there's no server involved in processing your files at all.",
  },
  {
    title: "The Chrome extension",
    body: "The EveryUtili extension (New Tab override and toolbar popup) stores only your recently visited tools, pinned tools, recent search queries, and a couple of display preferences (default search engine, clock format) — all locally in Chrome's own storage, using the standard chrome.storage.local API. None of this is transmitted anywhere, synced to an account, or shared with us or anyone else.",
  },
  {
    title: "What the extension does not do",
    body: "The extension makes no network requests of its own. Clicking a tool simply navigates your browser to the corresponding page on everyutili.com — the same as clicking any ordinary link. There is no analytics SDK, no tracking pixel, and no third-party script bundled with it.",
  },
  {
    title: "Cookies and analytics",
    body: "everyutili.com does not use tracking cookies or third-party analytics that identify you personally. Standard, privacy-respecting server logs (for uptime and abuse prevention) may be kept briefly, as is normal for any website.",
  },
  {
    title: "Contact",
    body: "Questions about this policy? Reach out at hello@everyutili.com.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="max-w-lg text-balance text-muted-foreground">
          The short version: nothing you process ever leaves your device, and the Chrome
          extension only remembers your own tool preferences, locally.
        </p>
      </div>

      <div className="mt-12 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-lg font-bold tracking-tight">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>
    </div>
  );
}
