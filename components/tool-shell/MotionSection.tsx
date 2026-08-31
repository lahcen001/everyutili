"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Thin client boundary that fades/slides its children in on mount. Kept
 * separate from ToolLayout (a server component) so the surrounding
 * breadcrumbs/H1/JSON-LD stay server-rendered — only the interactive tool
 * itself needs a client-side entrance animation.
 */
export function MotionSection({ children }: { children: ReactNode }) {
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
