"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/routing";
import { getToolBySlug } from "@/config/tools";

export interface BentoTool {
  slug: string;
  category: string;
  shortName: string;
  subheading: string;
  /** First tool in a category renders larger, spanning two columns. */
  featured?: boolean;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const cardSpring = { type: "spring" as const, stiffness: 400, damping: 25 };

export function BentoToolGrid({ tools }: { tools: BentoTool[] }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {tools.map((tool) => {
        const Icon = getToolBySlug(tool.slug)?.icon;
        return (
          <motion.div
            key={tool.slug}
            variants={item}
            whileHover={{ y: -3 }}
            transition={cardSpring}
            className={tool.featured ? "sm:col-span-2" : ""}
          >
            <Link
              href={`/tools/${tool.category}/${tool.slug}`}
              className={`card-glass group relative block h-full overflow-hidden rounded-2xl p-5 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-lg ${
                tool.featured ? "bg-hero-glow" : ""
              }`}
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "radial-gradient(180px circle at var(--x, 50%) var(--y, 50%), color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
                }}
              />
              <div className="relative flex h-full flex-col">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                  {Icon && <Icon className="h-5 w-5" />}
                </span>
                <h3 className="mt-3 font-semibold tracking-tight">{tool.shortName}</h3>
                <p className="mt-1 flex-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
                  {tool.subheading}
                </p>
                <ArrowRight className="mt-3 h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 rtl:-scale-x-100 group-hover:translate-x-1 group-hover:opacity-100 rtl:group-hover:-translate-x-1" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
