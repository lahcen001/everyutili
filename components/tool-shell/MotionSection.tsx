"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { useAppMode } from "@/components/pwa/useAppMode";

/**
 * Thin client boundary that fades/slides its children in on mount. Kept
 * separate from ToolLayout (a server component) so the surrounding
 * breadcrumbs/H1/JSON-LD stay server-rendered — only the interactive tool
 * itself needs a client-side entrance animation.
 */
export function MotionSection({ children }: { children: ReactNode }) {
  const { lite } = useAppMode();
  // On older phones (lite mode) skip the entrance animation entirely.
  if (lite) return <div>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
