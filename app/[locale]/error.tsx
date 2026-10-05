"use client";

import { ErrorFallback } from "@/components/tool-shell/ErrorFallback";

export default function LocaleError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <ErrorFallback onRetry={retry} />
    </div>
  );
}
