"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { consumeHandoff } from "@/lib/storage/toolPipelineDb";

/**
 * Picks up a "Send to next tool" handoff (see lib/storage/toolPipelineDb.ts)
 * when the tool page is opened as `?from=<id>`. Converts the stashed Blob
 * back into a File (matching what DropZone's onFiles hands to every tool)
 * and calls `onFile` with it — so a receiving tool needs zero changes to
 * its own file-handling logic beyond calling this hook once.
 *
 * Strips the `?from=` param after consuming (success or not) so a page
 * refresh doesn't try to re-consume an already-deleted handoff.
 */
export function useIncomingHandoff(onFile: (file: File) => void): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const onFileRef = React.useRef(onFile);

  React.useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  const handoffId = searchParams.get("from");

  React.useEffect(() => {
    if (!handoffId) return;

    let cancelled = false;

    consumeHandoff(handoffId).then((handoff) => {
      if (cancelled) return;

      // Strip the param regardless of outcome, so a stale/expired id never
      // lingers in the URL and re-triggers on refresh.
      const next = new URLSearchParams(window.location.search);
      next.delete("from");
      const nextUrl = next.toString()
        ? `${window.location.pathname}?${next.toString()}`
        : window.location.pathname;
      router.replace(nextUrl, { scroll: false });

      if (!handoff) return;
      const file = new File([handoff.blob], handoff.fileName, { type: handoff.blob.type });
      onFileRef.current(file);
    });

    return () => {
      cancelled = true;
    };
  }, [handoffId, router]);
}
