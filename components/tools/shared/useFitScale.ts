import * as React from "react";

/**
 * Tracks the size of a container and returns the scale (never above 1) at which an image of the given
 * natural size fits inside it completely — both width and height — so nothing needs scrolling.
 */
export function useFitScale(naturalWidth: number, naturalHeight: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBox({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = box.width > 0 && box.height > 0 && naturalWidth > 0 && naturalHeight > 0 ? Math.min(1, box.width / naturalWidth, box.height / naturalHeight) : 1;
  return { ref, scale, box };
}
