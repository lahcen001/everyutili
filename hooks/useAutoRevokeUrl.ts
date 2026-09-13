"use client";

import * as React from "react";

/**
 * Wraps `URL.createObjectURL` so a component never has to hand-roll its own
 * revoke-on-replace / revoke-on-unmount bookkeeping for a single object URL
 * at a time (e.g. one image/video preview). Calling `createUrl` again always
 * revokes whatever URL it previously returned before creating the new one,
 * and the URL is also revoked automatically when the component unmounts.
 *
 * For tools that track a URL per item in a list (batch converters), keep
 * using the existing `Map<id, url>` + sync-effect pattern already used in
 * ImageCompressor.tsx/HeicToJpg.tsx/etc. — this hook is for the common
 * single-preview case (see ImageCropper.tsx, ImageResizer.tsx).
 */
export function useAutoRevokeUrl() {
  const [url, setUrl] = React.useState<string | null>(null);
  const activeUrlRef = React.useRef<string | null>(null);

  const createUrl = React.useCallback((blob: Blob | File | null): string | null => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }

    if (!blob) {
      setUrl(null);
      return null;
    }

    const newUrl = URL.createObjectURL(blob);
    activeUrlRef.current = newUrl;
    setUrl(newUrl);
    return newUrl;
  }, []);

  const revokeUrl = React.useCallback(() => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
      setUrl(null);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = null;
      }
    };
  }, []);

  return { url, createUrl, revokeUrl };
}
