import PptxGenJS from "pptxgenjs";
import { marked } from "marked";

export type SlideLayout = "title" | "section" | "content";
export type AspectRatio = "16:9" | "4:3";

export interface SlideDraft {
  id: string;
  layout: SlideLayout;
  title: string;
  /** One bullet (or subtitle line) per line. */
  body: string;
}

export interface SlideTheme {
  id: string;
  name: string;
  font: string;
  bg: string;
  text: string;
  accent: string;
  titleBg: string;
  titleText: string;
  titleSub: string;
}

// Hex colors without "#", as pptxgenjs expects. Fonts are ones PowerPoint ships with on Windows and macOS.
export const THEMES: SlideTheme[] = [
  { id: "classic", name: "Classic", font: "Calibri", bg: "FFFFFF", text: "1F2937", accent: "1D4ED8", titleBg: "1E3A8A", titleText: "FFFFFF", titleSub: "BFDBFE" },
  { id: "midnight", name: "Midnight", font: "Calibri", bg: "0F172A", text: "E2E8F0", accent: "22D3EE", titleBg: "020617", titleText: "FFFFFF", titleSub: "67E8F9" },
  { id: "sunrise", name: "Sunrise", font: "Georgia", bg: "FFF7ED", text: "431407", accent: "EA580C", titleBg: "C2410C", titleText: "FFF7ED", titleSub: "FED7AA" },
  { id: "forest", name: "Forest", font: "Trebuchet MS", bg: "F0FDF4", text: "14532D", accent: "16A34A", titleBg: "14532D", titleText: "F0FDF4", titleSub: "BBF7D0" },
  { id: "ocean", name: "Ocean", font: "Arial", bg: "F8FAFC", text: "0F172A", accent: "0284C7", titleBg: "0369A1", titleText: "FFFFFF", titleSub: "BAE6FD" },
  { id: "slate", name: "Slate", font: "Arial", bg: "27272A", text: "F4F4F5", accent: "FBBF24", titleBg: "18181B", titleText: "FAFAFA", titleSub: "FDE68A" },
  { id: "rose", name: "Rose", font: "Georgia", bg: "FFF1F2", text: "4C0519", accent: "DB2777", titleBg: "9D174D", titleText: "FFF1F2", titleSub: "FBCFE8" },
  { id: "mono", name: "Mono", font: "Arial", bg: "FFFFFF", text: "111111", accent: "111111", titleBg: "111111", titleText: "FFFFFF", titleSub: "D4D4D4" },
];

export const SLIDE_WIDTH_IN = 10;

export function slideHeightIn(ratio: AspectRatio): number {
  return ratio === "16:9" ? 5.625 : 7.5;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlideGeometry {
  fullBleed: boolean;
  titleBox: Box;
  titleSize: number;
  titleAlign: "left" | "center";
  titleValign: "top" | "middle";
  bodyBox: Box;
  bodySize: number;
  bodyAlign: "left" | "center";
  bullets: boolean;
  accentBar: Box;
}

/** Single source of truth for positions (inches) and sizes (pt), used by both the live preview and the .pptx export. */
export function getGeometry(layout: SlideLayout, ratio: AspectRatio): SlideGeometry {
  const W = SLIDE_WIDTH_IN;
  const H = slideHeightIn(ratio);

  if (layout === "title") {
    return {
      fullBleed: true,
      titleBox: { x: 0.8, y: H * 0.26, w: W - 1.6, h: H * 0.26 },
      titleSize: 40,
      titleAlign: "center",
      titleValign: "middle",
      bodyBox: { x: 1.2, y: H * 0.58, w: W - 2.4, h: H * 0.24 },
      bodySize: 20,
      bodyAlign: "center",
      bullets: false,
      accentBar: { x: W / 2 - 0.6, y: H * 0.545, w: 1.2, h: 0.06 },
    };
  }
  if (layout === "section") {
    return {
      fullBleed: true,
      titleBox: { x: 0.9, y: H * 0.34, w: W - 1.8, h: H * 0.3 },
      titleSize: 38,
      titleAlign: "left",
      titleValign: "middle",
      bodyBox: { x: 0.9, y: H * 0.66, w: W - 1.8, h: H * 0.2 },
      bodySize: 18,
      bodyAlign: "left",
      bullets: false,
      accentBar: { x: 0.5, y: H * 0.34, w: 0.12, h: H * 0.3 },
    };
  }
  return {
    fullBleed: false,
    titleBox: { x: 0.6, y: 0.35, w: W - 1.2, h: 0.9 },
    titleSize: 30,
    titleAlign: "left",
    titleValign: "middle",
    bodyBox: { x: 0.6, y: 1.55, w: W - 1.2, h: H - 2.1 },
    bodySize: 20,
    bodyAlign: "left",
    bullets: true,
    accentBar: { x: 0.6, y: 1.28, w: 1.2, h: 0.06 },
  };
}

export function bodyLines(body: string): string[] {
  return body.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

export function newSlide(layout: SlideLayout = "content"): SlideDraft {
  return { id: crypto.randomUUID(), layout, title: "", body: "" };
}

function stripInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Turns Markdown or plain text into slide drafts. With Markdown headings, each heading starts a slide and the
 * paragraphs/list items under it become its body. Without headings, blank-line-separated blocks become slides
 * (first line = title). The first slide becomes a title slide; a top-level heading with no body becomes a section slide.
 */
export function parseSlides(input: string): SlideDraft[] {
  const tokens = marked.lexer(input);
  const hasHeadings = tokens.some((t) => t.type === "heading");
  const drafts: (SlideDraft & { depth: number })[] = [];

  if (hasHeadings) {
    const current = () => {
      if (drafts.length === 0) drafts.push({ ...newSlide(), depth: 6 });
      return drafts[drafts.length - 1];
    };
    for (const token of tokens) {
      if (token.type === "heading") {
        drafts.push({ ...newSlide(), title: stripInline(token.text), depth: token.depth });
      } else if (token.type === "paragraph") {
        const slide = current();
        slide.body += (slide.body ? "\n" : "") + token.text.split("\n").map(stripInline).join("\n");
      } else if (token.type === "list") {
        const slide = current();
        for (const item of token.items) {
          slide.body += (slide.body ? "\n" : "") + stripInline(item.text);
        }
      }
    }
  } else {
    input
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0)
      .forEach((block) => {
        const lines = block.split(/\r?\n/).map(stripInline);
        drafts.push({ ...newSlide(), title: lines[0], body: lines.slice(1).join("\n"), depth: 6 });
      });
  }

  drafts.forEach((slide, i) => {
    if (i === 0) slide.layout = "title";
    else if (slide.depth === 1 && bodyLines(slide.body).length === 0) slide.layout = "section";
  });

  return drafts.map((slide) => ({ id: slide.id, layout: slide.layout, title: slide.title, body: slide.body }));
}

export const SAMPLE_DECK: SlideDraft[] = [
  { id: "s1", layout: "title", title: "My Presentation", body: "A subtitle that sets the scene" },
  { id: "s2", layout: "content", title: "Agenda", body: "Where we are today\nWhat we learned\nWhat comes next" },
  { id: "s3", layout: "section", title: "Key Results", body: "" },
  { id: "s4", layout: "content", title: "Highlights", body: "Revenue up 24% year over year\nTwo new markets launched\nCustomer satisfaction at an all-time high" },
];

export async function buildPptx(slides: SlideDraft[], theme: SlideTheme, ratio: AspectRatio): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = ratio === "16:9" ? "LAYOUT_16x9" : "LAYOUT_4x3";
  for (const draft of slides) {
    const geo = getGeometry(draft.layout, ratio);
    const slide = pptx.addSlide();
    slide.background = { color: geo.fullBleed ? theme.titleBg : theme.bg };

    slide.addShape(pptx.ShapeType.rect, {
      ...geo.accentBar,
      fill: { color: theme.accent },
      line: { color: theme.accent, width: 0 },
    });

    const titleColor = geo.fullBleed ? theme.titleText : theme.accent;
    if (draft.title.trim()) {
      slide.addText(draft.title, {
        ...geo.titleBox,
        fontFace: theme.font,
        fontSize: geo.titleSize,
        bold: true,
        color: titleColor,
        align: geo.titleAlign,
        valign: geo.titleValign,
        margin: 0,
        fit: "shrink",
      });
    }

    const lines = bodyLines(draft.body);
    if (lines.length > 0) {
      slide.addText(
        lines.map((text) => ({
          text,
          options: geo.bullets
            ? { bullet: { indent: 18 }, breakLine: true, paraSpaceAfter: 8 }
            : { breakLine: true, paraSpaceAfter: 6 },
        })),
        {
          ...geo.bodyBox,
          fontFace: theme.font,
          fontSize: geo.bodySize,
          color: geo.fullBleed ? theme.titleSub : theme.text,
          align: geo.bodyAlign,
          valign: "top",
          margin: 0,
          fit: "shrink",
        }
      );
    }
  }

  const blob = await pptx.write({ outputType: "blob" });
  return blob as Blob;
}
