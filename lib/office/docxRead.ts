import mammoth from "mammoth";

import { blocksToMarkdown, parseHtml, type Block } from "@/lib/office/docModel";

export interface DocxContent {
  html: string;
  markdown: string;
  text: string;
  warnings: string[];
}

/** Reads a .docx into HTML (images embedded as data URLs), Markdown and plain text. */
export async function readDocx(file: File): Promise<DocxContent> {
  const arrayBuffer = await file.arrayBuffer();
  const [html, raw] = await Promise.all([mammoth.convertToHtml({ arrayBuffer }), mammoth.extractRawText({ arrayBuffer })]);
  // Markdown is generated from the same document model the other tools use (mammoth's own Markdown output is deprecated).
  const markdown = blocksToMarkdown(parseHtml(html.value));
  return { html: html.value, markdown, text: raw.value, warnings: [...new Set(html.messages.map((m) => m.message))] };
}

export function stripHtmlImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, "");
}

export function stripMarkdownImages(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
}

export function wrapHtmlDocument(body: string, title: string): string {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${safeTitle}</title>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Reads a .docx straight into document blocks (images kept as data URLs) for PDF output. */
export async function readDocxBlocks(file: File): Promise<{ blocks: Block[]; warnings: string[] }> {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return { blocks: parseHtml(result.value), warnings: [...new Set(result.messages.map((m) => m.message))] };
}
